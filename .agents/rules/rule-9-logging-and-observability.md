---
trigger: always_on
---

# Rule 9: Logging & Observability

## Logger Decision
- [DECISION NEEDED]: Choose one logger and remove the other:
    Option A — Pino (recommended for NestJS + VPS)
      - Fastest Node.js logger, low overhead on a shared VPS
      - JSON output by default — easy to parse and grep
      - Use nestjs-pino for NestJS integration
    Option B — Winston
      - More flexible transports
      - Slightly more overhead than Pino
      - Use nest-winston for NestJS integration

- Until decided: use NestJS built-in logger for development only.
- Logger must be configured in a dedicated LoggerModule in common/logger/
  and imported globally in app.module.ts.
- Never use console.log, console.error, or console.warn anywhere in the codebase.
  ESLint no-console rule enforces this.

## Log Levels & When to Use Each
- error  : Something broke and needs immediate attention
            (unhandled exceptions, DB failures, payment processing errors)
- warn   : Something unusual but the app is still running
            (rate limit approaching, fallback chain triggered, retried job)
- info   : Normal significant events worth recording
            (bid placed, auction closed, payment confirmed, user logged in)
- debug  : Detailed diagnostic info for development only
            (query params, DTO contents, service method entry/exit)
- verbose: Extremely detailed, never enabled in production

Log level per environment:
  development : debug
  staging     : info
  production  : warn (info for critical domain events — see Critical Events below)

## Log Format
- Always log in structured JSON format — never plain text strings.
- Every log entry must include these base fields:

{
  "timestamp"    : "2026-04-23T10:32:01.123Z",  // ISO 8601 always
  "level"        : "info",
  "context"      : "BidsService",               // class or module name
  "requestId"    : "uuid",                      // correlation ID (see below)
  "userId"       : "uuid | null",               // null if unauthenticated
  "message"      : "Bid accepted",
  "data"         : { ... }                      // relevant event data
}

- Never concatenate data into the message string:
  ❌ logger.info(`Bid ${bidId} placed by ${userId}`)
  ✅ logger.info('Bid placed', { bidId, userId, amount, auctionId })

## Correlation ID (Request Tracking)
- Every incoming HTTP request must be assigned a unique requestId (UUID).
- requestId is generated in a global LoggingInterceptor in common/interceptors/.
- requestId is attached to:
    Every log entry for the duration of that request
    The response header: X-Request-Id
- Use AsyncLocalStorage to propagate requestId through the call stack without
  passing it manually through every method.
- For async jobs and event handlers, generate a jobId and use it in place of requestId.

## What to Log — Per Layer

### Controller Layer
- Log at info level on every incoming request (via LoggingInterceptor globally):
    method, url, requestId, userId, statusCode, responseTimeMs
- Do not log request body in controller — may contain sensitive data.

### Service Layer
- Log at info level for all critical domain events (see Critical Events below).
- Log at warn level when a business rule violation is caught and an exception is thrown.
- Log at debug level for method entry with sanitized input (no sensitive fields).

### Repository Layer
- Log at debug level for query execution time.
- Log at error level for any DB error before rethrowing.
- Never log raw SQL queries in production.

### Auth Layer
- Log at info level: successful login, logout, token refresh.
- Log at warn level: failed login attempt, account locked, token reuse detected.
- Log at error level: unexpected auth failures.

### Queue / Event Handlers
- Log at info level: job started, job completed with duration.
- Log at warn level: job retrying with attempt number and reason.
- Log at error level: job failed after max retries, dead-letter queue entry.

## Critical Domain Events (Always log at info in ALL environments)
These must never be silenced even in production warn-level config:

  bid.submitted         → { bidId, auctionId, userId, amount }
  bid.accepted          → { bidId, auctionId, userId, amount, newLeadingBid }
  bid.rejected          → { bidId, auctionId, userId, reason, errorCode }
  auction.activated     → { auctionId, firstBidAt, closesAt }
  auction.closed        → { auctionId, closedAt, totalBids, winnerId, winningAmount }
  auction.settled       → { auctionId, winnerId, finalAmount, settledAt }
  auction.abandoned     → { auctionId, totalBidders, abandonedAt }
  payment.window.started→ { auctionId, winnerId, paymentDeadline }
  payment.window.expired→ { auctionId, defaultedUserId, nextBidderId | null }
  payment.confirmed     → { auctionId, userId, amount, confirmedAt }
  user.login            → { userId, ip, timestamp }
  user.login.failed     → { email, ip, attemptCount, timestamp }
  user.account.locked   → { userId, ip, timestamp }

## What to NEVER Log (Security Rules)
- Passwords or password hashes
- JWT tokens (access or refresh)
- Payment card numbers or bank details
- Raw bid amounts in combination with user PII
- Full request/response bodies on auth endpoints
- Environment variables or config values
- Any field marked as sensitive in the entity

## Log Retention & Storage (VPS Specific)
- Logs are written to stdout only — never write to files directly in the app.
- Use a process manager (PM2) to capture stdout and write to log files on the VPS.
- Recommended PM2 log setup:
    /var/log/bids-bazar-api/app.log      # combined log
    /var/log/bids-bazar-api/error.log    # error level only
- Enable log rotation to prevent disk exhaustion on shared VPS:
    Max file size : 10MB per file
    Max files     : 7 days retention
    Use pm2-logrotate module
- [DECISION NEEDED]: If log volume grows, consider shipping logs to an external
  service (Grafana Loki, Logtail, Papertrail) — all work well on a VPS budget.

## Performance Logging
- Log response time on every request via LoggingInterceptor:
    warn if responseTime > 1000ms
    error if responseTime > 3000ms
- Log DB query time at debug level for all repository calls.
- Log job execution time for all queue processors:
    warn if job takes > 5000ms

## Global Logging Interceptor
Implement in common/interceptors/logging.interceptor.ts:
- Runs on every request automatically (registered globally in app.module.ts)
- Generates and attaches requestId
- Logs request start: method, url, userId
- Logs request end: statusCode, responseTimeMs
- Never logs request/response body globally — only specific endpoints may log
  body at debug level when explicitly needed

## Logging Module Structure
src/
└── common/
    └── logger/
        ├── logger.module.ts        # Global logger module
        ├── logger.service.ts       # Wrapper around chosen logger (Pino or Winston)
        └── logging.interceptor.ts  # Global request/response logger

## Future Observability Path (when ready to scale)
When the app outgrows basic logging on VPS, add in this order:
  Step 1 — Metrics  : Add Prometheus metrics via @willsoto/nestjs-prometheus
                       Track: active auctions, bids per minute, payment success rate
  Step 2 — Dashboards: Add Grafana connected to Prometheus (free, self-hostable on VPS)
  Step 3 — Tracing  : Add OpenTelemetry for distributed tracing if splitting to
                       microservices later