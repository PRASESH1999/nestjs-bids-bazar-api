---
trigger: always_on
---

# Rule 7: Events & Queues

## Core Principles
- Async-first: any operation that does not need to block the HTTP response must be
  handled asynchronously via a queue or event.
- Events are the source of truth for state transitions — every major domain state change
  must emit a corresponding event.
- The HTTP response is returned to the client as soon as the synchronous part completes —
  never make the client wait for async side effects.

## [DECISION NEEDED]: Queue / Event System
Choose one and remove the others before going to production:

  Option A — BullMQ (recommended for single-service, Redis-based, NestJS native support)
    - Use @nestjs/bull or @nestjs/bullmq
    - Requires Redis instance
    - Best fit for job scheduling, retries, delayed jobs (payment window timers)

  Option B — RabbitMQ
    - Use @nestjs/microservices with RabbitMQ transport
    - Best fit if planning to split into microservices later
    - More ops overhead than BullMQ

  Option C — Kafka
    - Use @nestjs/microservices with Kafka transport
    - Best fit for high-throughput, event streaming at scale
    - Significant ops overhead — only if scale demands it

  Option D — NestJS EventEmitter (interim only)
    - Use @nestjs/event-emitter for in-process events
    - Zero infrastructure overhead
    - No persistence, no retries, no dead-letter — NOT suitable for production
    - Use only during early development until a queue system is decided

Until decided: use NestJS EventEmitter as a temporary in-process solution.
Design all event handlers to be swappable — abstract behind an EventBus interface
so the underlying system can be replaced without rewriting handlers.

## [DECISION NEEDED]: Real-Time Client Broadcasting
Choose one when ready:

  Option A — WebSockets via @nestjs/websockets + Socket.io
    - Full duplex, best for live bid updates and auction countdowns
    - Requires sticky sessions or Redis adapter for multi-instance deployments

  Option B — Server-Sent Events (SSE)
    - Simpler, unidirectional, HTTP-based
    - Good for auction status and bid feed updates
    - No special infrastructure needed

  Option C — Polling
    - Simplest, no infrastructure
    - Acceptable only for low-frequency updates
    - Not recommended for a live bidding experience

Until decided: do not implement real-time broadcasting. Design event emission so
broadcasting can be plugged into existing event handlers later with no restructuring.

## Event Naming Conventions
- All event names in dot.notation, lowercase, past tense (something that happened):
    bid.submitted
    bid.accepted
    bid.rejected
    auction.activated       (first bid placed, timer started)
    auction.closed          (timer expired)
    auction.settled         (payment confirmed, winner finalized)
    auction.abandoned       (all bidders defaulted)
    payment.window.started  (winner notified, 18hr clock started)
    payment.window.expired  (winner failed to pay, fallback triggered)
    payment.confirmed       (payment received)
    user.account.locked

- Event names are defined as constants in common/events/event-names.ts — never
  hardcoded as raw strings anywhere in the codebase.

## Async Operations (All of the below must be handled via queue/events)

### Bid Placement & Validation
- HTTP request accepts the bid synchronously, persists it, returns 201 immediately.
- Post-acceptance side effects are async:
    Notify outbid bidder (email/push)
    Update auction leaderboard cache
    Broadcast new leading bid to clients (when real-time is implemented)

### Auction Closing & Winner Determination
- Auction closing is triggered by a scheduled job (delayed job or cron):
    Job scheduled at auction activation for closesAt timestamp
    On trigger: transition auction ACTIVE → CLOSED
    Rank all ACCEPTED bids, lock fallback chain
    Emit auction.closed event
- Winner determination is handled by auction.closed event handler:
    Transition auction CLOSED → AWAITING_PAYMENT
    Assign paymentDeadline = closedAt + 18hrs
    Emit payment.window.started event
    Notify winner (email/push) — async

### Payment Window Tracking & Fallback
- On payment.window.started: schedule a delayed job for 18hrs.
- On job trigger (payment window expired):
    If payment confirmed → do nothing (already SETTLED)
    If payment not confirmed:
      Mark current winner bid as PAYMENT_DEFAULTED
      Emit payment.window.expired event
      Payment.window.expired handler:
        Promote next bidder in fallback chain
        If next bidder exists → restart AWAITING_PAYMENT, schedule new 18hr job
        If no bidders remain → transition auction to ABANDONED, emit auction.abandoned
- Payment confirmation is always triggered by an explicit payment service call —
  never assumed or auto-confirmed.

## Queue & Job Conventions
- Every job type has a dedicated processor class in its feature module:
    e.g. auctions/processors/auction-close.processor.ts
    e.g. auctions/processors/payment-window.processor.ts
- Job names defined as constants — never raw strings.
- All jobs must have:
    Retry policy     : minimum 3 retries with exponential backoff
    Timeout          : defined per job type — never infinite
    Dead-letter      : failed jobs after max retries go to a dead-letter queue
    Logging          : log on start, success, failure with jobId and context

## Retry & Dead-Letter Policy
- Max retries: 3 (exponential backoff: 1s, 5s, 30s)
- After max retries: move to dead-letter queue + alert on-call via logging/monitoring.
- Dead-letter queue must be monitored — stale jobs are a critical failure signal.
- [DECISION NEEDED]: Define alerting mechanism for dead-letter jobs
  (e.g. PagerDuty, Slack alert, email to admin)

## Event Handler Rules
- Event handlers live in their respective feature module under handlers/:
    e.g. auctions/handlers/auction-closed.handler.ts
    e.g. auctions/handlers/payment-window-expired.handler.ts
- Handlers must be idempotent — processing the same event twice must not cause
  duplicate side effects. Always check current state before acting.
- Handlers must not throw unhandled exceptions — catch, log, and let the queue
  retry policy take over.
- Never put business logic in handlers — call the appropriate service method instead.
- Handlers are thin orchestrators: receive event → call service → done.

## Folder Structure
src/
└── modules/
    └── auctions/
        ├── handlers/
        │   ├── auction-closed.handler.ts
        │   └── payment-window-expired.handler.ts
        └── processors/
            ├── auction-close.processor.ts
            └── payment-window.processor.ts
└── common/
    └── events/
        └── event-names.ts      # Single source of truth for all event name constants