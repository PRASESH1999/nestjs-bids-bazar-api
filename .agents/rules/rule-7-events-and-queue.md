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

Until decided: use NestJS EventEmitter as a temporary in-process solution
(`EventEmitterModule.forRoot()` is wired in `AppModule`).
Design all event handlers to be swappable — abstract behind an EventBus interface
so the underlying system can be replaced without rewriting handlers.

## Real-Time Client Broadcasting — Chosen: Option B (SSE)

The pilot uses **Server-Sent Events (SSE)** for live client updates. The
product detail page subscribes to `GET /products/:id/events`, an SSE stream
served by `BiddingController` and produced by `AuctionBroadcastService`.

  Option A — WebSockets via @nestjs/websockets + Socket.io
    - Full duplex, best for live bid updates and auction countdowns
    - Requires sticky sessions or Redis adapter for multi-instance deployments

  Option B — Server-Sent Events (SSE) — CHOSEN
    - Simpler, unidirectional, HTTP-based
    - Good for auction status and bid feed updates
    - No special infrastructure needed

  Option C — Polling
    - Simplest, no infrastructure
    - Acceptable only for low-frequency updates
    - Not recommended for a live bidding experience

Current implementation:
- `AuctionBroadcastService` holds a single in-memory `RxJS Subject`, filtered
  per `productId` for each subscriber.
- Consumed only on the product detail page via the public SSE endpoint above.
- The Subject is **single-instance only**. Scaling to multiple Node instances
  requires swapping it for a pub/sub adapter (e.g. Redis Pub/Sub) so events
  emitted on one instance reach SSE subscribers on another. This is the
  single change required at scale; handlers do not need to be rewritten.

## Event Naming Conventions
- All event names in dot.notation, lowercase, past tense (something that happened):
    bid.submitted             — implemented (emitted by `BiddingService.placeBid` after commit)
    bid.accepted              — planned
    bid.rejected              — planned
    auction.activated         — planned (first bid placed, timer started)
    auction.closed            — implemented (emitted by `AuctionLifecycleService.closeIfExpired` after commit)
    auction.settled           — implemented (emitted by `AuctionLifecycleService.confirmPaymentManual` after commit)
    auction.abandoned         — planned (all bidders defaulted)
    payment.window.started    — planned (winner notified, payment clock started)
    payment.window.expired    — planned (winner failed to pay, fallback triggered)
    payment.confirmed         — planned
    user.account.locked       — planned

  Only `bid.submitted`, `auction.closed`, and `auction.settled` are wired
  today. The rest are reserved names — they will appear in
  `EventNames` once the corresponding service emit points are added.

- Event names are defined as constants in `src/common/events/event-names.ts` — never
  hardcoded as raw strings anywhere in the codebase. Payload types live in
  `src/common/events/event-payloads.type.ts`.

## Async Operations (All of the below must be handled via queue/events)

### Bid Placement & Validation
- HTTP request accepts the bid synchronously, persists it, returns 201 immediately.
- Post-acceptance side effects are async:
    Notify outbid bidder (email/push) — currently sent inline in `BiddingService.placeBid` post-commit
    Update auction leaderboard cache — not yet implemented
    Broadcast new leading bid to clients — implemented via `bid.submitted` → `BidSubmittedHandler` → `AuctionBroadcastService.broadcastUpdate`

### Auction Closing & Winner Determination
- Auction closing today runs via:
    `AuctionLifecycleCron` (every 1 minute) calling `AuctionLifecycleService.closeAllExpiredAuctions`
    Lazy closure inside `ProductsService.getPublicProductById` and `BiddingController.placeBid`
- Both paths call the same idempotent `AuctionLifecycleService.closeIfExpired(productId)`:
    Transition product `ACTIVE` → `AWAITING_PAYMENT` (the `CLOSED` enum value is a transient audit state — the
    product moves directly to `AWAITING_PAYMENT` inside the same transaction)
    Pick highest bid as winner (tiebreaker: earliest `placedAt`)
    Assign `paymentDeadline = now + PAYMENT_WINDOW_HOURS` (config-driven, see Rule 14)
    Emit `auction.closed` event after commit
- When a queue is added, the cron path will be replaced by a delayed job scheduled at
  `product.biddingEndsAt`. The lazy-closure defense-in-depth remains.

### Payment Window Tracking & Fallback
- Payment-window expiry today runs via:
    `AuctionLifecycleCron` calling `expireAllOverduePaymentWindows`
    Lazy expiry inside `ProductsService.getPublicProductById` when status is `AWAITING_PAYMENT`
- Both paths call `AuctionLifecycleService.handlePaymentExpiry(productId)` which:
    Marks the responsible bid `EXPIRED` and `isCurrentlyPaymentResponsible = false`
    Promotes the next-highest `NOT_RESPONSIBLE` bid to responsible, with a fresh
    `paymentDeadline = now + PAYMENT_WINDOW_HOURS`
    If no remaining bids → product transitions to `ABANDONED`
- `payment.window.expired` and `auction.abandoned` events are not yet emitted —
  they are planned event names reserved for when this flow is converted to an
  event-driven pipeline.
- Payment confirmation is always triggered by an explicit admin call
  (`AuctionLifecycleService.confirmPaymentManual`) — never assumed or auto-confirmed.
  It emits `auction.settled` after commit.

## Queue & Job Conventions
- Every job type has a dedicated processor class in its feature module:
    e.g. bidding/processors/auction-close.processor.ts (planned)
    e.g. bidding/processors/payment-window.processor.ts (planned)
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
- Event handlers live in their respective feature module under `handlers/`:
    e.g. bidding/handlers/bid-submitted.handler.ts
    e.g. bidding/handlers/auction-closed.handler.ts
    e.g. bidding/handlers/auction-settled.handler.ts
- Handlers must be idempotent — processing the same event twice must not cause
  duplicate side effects. Always check current state before acting. Broadcast-only
  handlers (whose sole effect is pushing current state to subscribers) are naturally
  safe to replay and may skip the state-guard; a comment must call this out.
- Handlers must not throw unhandled exceptions silently — they must log AND rethrow
  so the queue retry policy can take over once a queue is in place.
- Never put business logic in handlers — call the appropriate service method instead.
- Handlers are thin orchestrators: receive event → call service → done.

## Service-Side Emission Rules
- Services emit events; services must NOT call the broadcast layer (or any
  handler) directly. The event bus is the only handoff.
- Events are emitted **after** `commitTransaction()` succeeds — never inside the
  transaction. An event for a rolled-back change is a correctness bug.
- Emission failure must never affect the HTTP response: wrap each emit in a
  try/catch and log, mirroring how post-commit emails are handled today.

## Folder Structure
src/
└── modules/
    └── bidding/
        ├── handlers/
        │   ├── bid-submitted.handler.ts
        │   ├── auction-closed.handler.ts
        │   └── auction-settled.handler.ts
        ├── processors/                           # planned, not yet present
        │   ├── auction-close.processor.ts
        │   └── payment-window.processor.ts
        └── services/
            ├── bidding.service.ts                # emits bid.submitted
            ├── auction-lifecycle.service.ts      # emits auction.closed, auction.settled
            └── auction-broadcast.service.ts      # SSE broadcast layer
└── common/
    └── events/
        ├── event-names.ts          # Single source of truth for all event name constants
        └── event-payloads.type.ts  # Typed payload interface per event
