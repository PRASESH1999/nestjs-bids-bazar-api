# Logging Reference

> Read this before adding any log statement anywhere in the codebase.
> Never use console.log, console.error, or console.warn — ever.
> All logging goes through the project logger only.
> Every log entry must be structured JSON with required base fields.

---

## Logger Setup — nestjs-pino

```typescript
// Already configured in AppModule — reference only
// See references/bootstrap.md for full LoggerModule config

LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    pinoHttp: {
      level: config.get<string>('app.logLevel', 'info'),
      transport:
        config.get('app.env') === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,        // JSON output in staging + production
      // Never log sensitive fields — ever
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.refreshToken',
        'req.body.currentPassword',
        'req.body.newPassword',
      ],
      customProps: (req: Request) => ({
        requestId: req.headers['x-request-id'],
      }),
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          // Never serialize full headers or body globally
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    },
  }),
}),
```

---

## Logger Injection — How to Use in Any Class

```typescript
// ✅ Always inject Logger from @nestjs/common
// Never instantiate Logger manually outside of a class
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BidsService {
  // Always pass class name as context
  private readonly logger = new Logger(BidsService.name);

  async placeBid(dto: CreateBidDto): Promise<BidEntity> {
    this.logger.log('Bid placement started', {
      requestId: this.cls.get('requestId'),
      userId: this.cls.get('userId'),
      auctionId: dto.auctionId,
    });
  }
}

// ✅ In non-injectable classes (handlers, processors)
// Use Logger with explicit context string
const logger = new Logger('AuctionClosedHandler');
```

---

## Log Levels

| Level | When to Use | Examples |
|---|---|---|
| `error` | Something broke — needs immediate attention | DB failure, unhandled exception, job failed after max retries |
| `warn` | Unusual but app still running | Slow response, rate limit approaching, failed login, job retrying |
| `log` (info) | Normal significant events | Bid placed, auction closed, user logged in, payment confirmed |
| `debug` | Detailed diagnostic — dev only | Query params, service method entry, DTO contents |
| `verbose` | Extremely detailed — never in production | Internal state dumps |

### Log Level Per Environment
| Environment | Level | What Gets Logged |
|---|---|---|
| development | debug | Everything |
| staging | log (info) | info + warn + error |
| production | warn | warn + error + critical domain events |

> Critical domain events (see below) are always logged at `log`
> level regardless of environment log level setting.

---

## Required Base Fields — Every Log Entry

Every log statement must include these fields as a structured object.
Never concatenate data into the message string.

```typescript
// ✅ Correct — structured fields
this.logger.log('Bid accepted', {
  requestId: this.cls.get<string>('requestId'),
  userId: this.cls.get<string>('userId'),
  bidId: bid.id,
  auctionId: dto.auctionId,
  amount: dto.amount,
});

// ❌ Wrong — string interpolation
this.logger.log(`Bid ${bid.id} placed by ${userId} for ${dto.amount}`);

// ❌ Wrong — no context fields
this.logger.log('Bid accepted');
```

### Base Fields Reference
```typescript
{
  requestId: string,     // Always — from cls.get('requestId')
  userId: string | null, // Always — from cls.get('userId'), null if public
  // Then add relevant domain fields for the event
}
```

---

## What to Log — Per Layer

### Controller Layer
- Never add log statements in controllers.
- LoggingInterceptor handles all request/response logging globally.

### Service Layer
```typescript
// ✅ Log at log (info) level for critical domain events
this.logger.log('Bid accepted', {
  requestId, userId, bidId, auctionId, amount,
});

// ✅ Log at warn level for business rule violations caught
this.logger.warn('Self-bidding attempt blocked', {
  requestId, userId, auctionId,
});

// ✅ Log at debug level for method entry (dev only)
this.logger.debug('placeBid called', {
  requestId, auctionId: dto.auctionId,
});

// ✅ Log at error level for unexpected failures
this.logger.error('Unexpected error in placeBid', {
  requestId, userId, error: error.message,
  stack: error.stack,
});
```

### Repository Layer
```typescript
// ✅ Log at debug level for slow queries only
// Never log every query — too noisy
if (queryDurationMs > 500) {
  this.logger.warn('Slow query detected', {
    repository: 'BidsRepository',
    method: 'findFallbackChain',
    durationMs: queryDurationMs,
  });
}

// ✅ Log at error level for DB errors before rethrowing
this.logger.error('DB query failed', {
  error: error.message,
  code: (error as any).code,
});
throw error;
```

### Auth Layer
```typescript
// ✅ Login events
this.logger.log('User logged in', { userId, requestId });
this.logger.log('User registered', { userId, email, requestId });
this.logger.log('User logged out', { userId, requestId });
this.logger.log('Tokens refreshed', { userId, requestId });

// ✅ Security events — always warn or error
this.logger.warn('Failed login attempt', {
  email,           // Email only — never password
  requestId,
  attemptCount: user.failedLoginAttempts,
});
this.logger.warn('Account locked', { userId, requestId });
this.logger.warn('Refresh token reuse detected', { userId, requestId });
```

### Queue / Event Handlers
```typescript
// ✅ Use jobId — not requestId (not available in async context)
const jobId = uuidv4();

this.logger.log('Job started', {
  jobId,
  jobName: 'auction-close',
  auctionId: payload.auctionId,
});

this.logger.log('Job completed', {
  jobId,
  jobName: 'auction-close',
  durationMs: Date.now() - startTime,
});

this.logger.warn('Job retrying', {
  jobId,
  jobName: 'auction-close',
  attempt: attemptNumber,
  reason: error.message,
});

this.logger.error('Job failed — max retries exceeded', {
  jobId,
  jobName: 'auction-close',
  error: error.message,
  stack: error.stack,
});
```

---

## Critical Domain Events — Always Log

These must always be logged at `log` level in ALL environments.
Never suppress these even if LOG_LEVEL is set to warn or error.

```typescript
// src/common/logger/critical-events.logger.ts
// Use this for critical domain events to bypass log level config

import { Logger } from '@nestjs/common';

// Bid events
logger.log('Bid submitted', { requestId, userId, bidId, auctionId, amount });
logger.log('Bid accepted', { requestId, userId, bidId, auctionId, amount, newLeadingBid: amount });
logger.log('Bid rejected', { requestId, userId, bidId, auctionId, reason, errorCode });

// Auction lifecycle
logger.log('Auction activated', { auctionId, firstBidAt, closesAt });
logger.log('Auction closed', { auctionId, closedAt, totalBids, winnerId, winningAmount });
logger.log('Auction settled', { auctionId, winnerId, finalAmount, settledAt });
logger.log('Auction abandoned', { auctionId, totalBidders, abandonedAt });

// Payment events
logger.log('Payment window started', { auctionId, winnerId, paymentDeadline });
logger.warn('Payment window expired', { auctionId, defaultedUserId, nextBidderId });
logger.warn('Payment defaulted', { auctionId, defaultedUserId });
logger.log('Payment confirmed', { auctionId, userId, amount, confirmedAt });

// Auth events
logger.log('User logged in', { userId, requestId });
logger.log('User registered', { userId, email, requestId });
logger.warn('Failed login attempt', { email, requestId, attemptCount });
logger.warn('Account locked', { userId, requestId });
logger.warn('Refresh token reuse detected', { userId, requestId });
```

---

## What to NEVER Log

```typescript
// ❌ Never log these — security violations

// Passwords or hashes
this.logger.log('Login', { password: dto.password });         // Never
this.logger.log('User', { passwordHash: user.password });     // Never

// Tokens
this.logger.log('Auth', { accessToken });                     // Never
this.logger.log('Auth', { refreshToken });                    // Never
this.logger.log('Auth', { refreshTokenHash });                // Never

// Payment details
this.logger.log('Payment', { cardNumber });                   // Never
this.logger.log('Payment', { bankAccount });                  // Never

// Raw bid amounts combined with full user PII
this.logger.log('Bid', {
  amount,
  userFullName,
  userAddress,       // Never combine financial + full PII
});

// Environment variables or config values
this.logger.log('Config', { jwtSecret });                     // Never
this.logger.log('Config', { dbPassword });                    // Never

// Stack traces exposed to client
// (GlobalExceptionFilter handles this — never log+return stack)
```

---

## Log Format — Production vs Development

### Development (pino-pretty)
[2026-04-23 10:32:01] INFO  (BidsService): Bid accepted
requestId: "550e8400-e29b-41d4-a716-446655440000"
userId: "abc-123"
bidId: "bid-456"
auctionId: "auction-789"
amount: 500

### Staging & Production (JSON)
```json
{
  "level": 30,
  "time": "2026-04-23T10:32:01.123Z",
  "context": "BidsService",
  "msg": "Bid accepted",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "abc-123",
  "bidId": "bid-456",
  "auctionId": "auction-789",
  "amount": 500
}
```

---

## PM2 Log Configuration — VPS

```javascript
// ecosystem.config.js — log settings per environment
module.exports = {
  apps: [
    {
      name: 'bids-bazar-api-production',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      out_file: '/var/log/bids-bazar-api/app.log',
      error_file: '/var/log/bids-bazar-api/error.log',
      merge_logs: true,           // Merge cluster instance logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'warn',
      },
    },
    {
      name: 'bids-bazar-api-staging',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      out_file: '/var/log/bids-bazar-api/staging-app.log',
      error_file: '/var/log/bids-bazar-api/staging-error.log',
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        LOG_LEVEL: 'info',
      },
    },
  ],
};
```

### PM2 Log Rotation Setup
```bash
# Install pm2-logrotate — prevents disk exhaustion on shared VPS
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M     # Rotate at 10MB
pm2 set pm2-logrotate:retain 7         # Keep 7 days
pm2 set pm2-logrotate:compress true    # Gzip rotated files
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'  # Daily at midnight
```

---

## Performance Logging Rules

```typescript
// ✅ Log response time via LoggingInterceptor (automatic — already done)
// ✅ Log slow queries in repositories
// ✅ Log job duration in processors

// Thresholds:
const SLOW_RESPONSE_MS = 1000;       // warn
const CRITICAL_RESPONSE_MS = 3000;   // error
const SLOW_QUERY_MS = 500;           // warn
const SLOW_JOB_MS = 5000;            // warn
```

---

## Logging Checklist

Before adding any log statement verify:

  ✅ Using this.logger — never console.*
  ✅ Logger initialized with class name: new Logger(ClassName.name)
  ✅ Correct log level for the event (see log levels table)
  ✅ Structured object — never string interpolation
  ✅ requestId included from cls.get('requestId')
  ✅ userId included from cls.get('userId')
  ✅ No sensitive fields (passwords, tokens, card numbers)
  ✅ Critical domain events always logged at log level
  ✅ Event handlers use jobId instead of requestId
  ✅ Error logs include error.message and error.stack
  ✅ No raw SQL queries in production logs