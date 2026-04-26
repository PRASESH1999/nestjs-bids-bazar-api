---
name: create-event-handler
description: >
  Use this skill when the user asks to create a new event handler,
  job processor, or any async operation triggered by a domain event.
  Triggers include: "create an event handler for X", "handle the Y
  event", "add a handler when Z happens", "create a job processor
  for X", "I need to do Y when Z event fires", "schedule a job for
  X", "add async processing for Y", "handle auction.closed event",
  "process payment window expiry". Always read this skill before
  writing any handler or processor file.
---

# Skill: create-event-handler

## References — Read Before Starting

- [SKILL.md] — project context, open decisions
- [references/events-queues.md] — event names, payload types,
  handler patterns, processor patterns, idempotency rules
- [references/conventions.md] — naming rules
- [references/logging.md] — jobId logging pattern for async
- [references/cls-context.md] — why CLS is not available in handlers
- [references/testing-standards.md] — how to test handlers
- [references/error-handling.md] — never swallow errors in handlers

---

## Step 0 — Extract Handler Details

Before writing any code confirm:

| Detail | Extract From Request |
|---|---|
| Event name | Which EventNames constant triggers this? |
| Handler type | Event handler / Job processor / Timer? |
| Module | Which feature module does this belong to? |
| What it does | What action does this handler take? |
| Idempotency | How to detect already-processed events? |
| Service method | Which service method does it call? |
| Side effects | Does it emit further events? Schedule timers? |

If the event name is not in EventNames constants — add it first.
If the payload type is not defined — add it to event-payloads.type.ts first.
Never write a handler before its event name and payload type exist.

---

## Step 1 — Check EventNames First

Before creating anything verify in
`src/common/events/event-names.ts`:

```typescript
// ✅ Event name must exist before handler is created
export const EventNames = {
  // ... existing names ...
  NEW_EVENT_NAME: 'new.event.name',  // Add if missing
} as const;
```

And in `src/common/events/event-payloads.type.ts`:
```typescript
// ✅ Payload type must exist before handler is created
export interface NewEventNamePayload {
  // All fields the handler needs
}
```

---

## Step 2 — Determine Handler Type

| Type | Use When | File Suffix |
|---|---|---|
| Event Handler | Reacts to a domain event (e.g. auction.closed) | `.handler.ts` |
| Job Processor | Schedules/manages delayed jobs (e.g. close timer) | `.processor.ts` |

Both live in `src/modules/<name>/handlers/` or `src/modules/<name>/processors/`.

---

## Step 3A — Event Handler Template

```typescript
// src/modules/<name>/handlers/<event-name>.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import { <EventName>Payload } from '@common/events/event-payloads.type';
import { <Name>Service } from '../<name>.service';
import { <Name>Status } from '@common/enums/<name>-status.enum';

@Injectable()
export class <EventName>Handler {
  private readonly logger = new Logger(<EventName>Handler.name);

  constructor(
    private readonly <name>Service: <Name>Service,
  ) {}

  @OnEvent(EventNames.<EVENT_NAME>, { async: true })
  async handle(payload: <EventName>Payload): Promise<void> {
    // ── 1. Generate jobId — CLS not available in async context ─────────
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.log('Handling <event-name> event', {
      jobId,
      // Add relevant payload fields for traceability
    });

    try {
      // ── 2. Idempotency check — ALWAYS before any action ────────────────
      // Check current state to detect already-processed events
      // Re-processing must never cause duplicate side effects
      const entity = await this.<name>Service.findById(payload.<entityId>);

      if (entity.status !== <Name>Status.<EXPECTED_STATUS>) {
        this.logger.warn(
          'Skipping <event-name> — already processed or invalid state',
          {
            jobId,
            entityId:      payload.<entityId>,
            currentStatus: entity.status,
          },
        );
        return;
      }

      // ── 3. Handler is a thin orchestrator — call service only ──────────
      // Never put business logic here — belongs in service
      await this.<name>Service.<actionMethod>(payload.<entityId>);

      // ── 4. Log success with duration ────────────────────────────────────
      this.logger.log('<EventName> handled successfully', {
        jobId,
        entityId:   payload.<entityId>,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      // ── 5. Never swallow errors — always log and rethrow ────────────────
      this.logger.error('Failed to handle <event-name> event', {
        jobId,
        entityId:  payload.<entityId>,
        error:     (error as Error).message,
        stack:     (error as Error).stack,
      });

      // Rethrow so retry policy can take over when queue is added
      throw error;
    }
  }
}
```

---

## Step 3B — Job Processor Template (Timer-Based)

```typescript
// src/modules/<name>/processors/<job-name>.processor.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import { <TriggerEvent>Payload } from '@common/events/event-payloads.type';
import { <Name>Service } from '../<name>.service';

@Injectable()
export class <JobName>Processor {
  private readonly logger = new Logger(<JobName>Processor.name);

  // Track scheduled timers — prevent duplicate scheduling
  private readonly scheduledJobs = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly <name>Service: <Name>Service,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Triggered by domain event to schedule a delayed job ────────────────
  @OnEvent(EventNames.<TRIGGER_EVENT>, { async: true })
  schedule(payload: <TriggerEvent>Payload): void {
    const { <entityId>, <deadline> } = payload;

    // ── Prevent duplicate scheduling ──────────────────────────────────────
    if (this.scheduledJobs.has(<entityId>)) {
      // Clear existing timer — e.g. when promoting to next bidder
      clearTimeout(this.scheduledJobs.get(<entityId>)!);
      this.scheduledJobs.delete(<entityId>);
      this.logger.log('Existing timer cleared — rescheduling', {
        <entityId>,
      });
    }

    const delayMs = <deadline>.getTime() - Date.now();

    // ── Handle already-past deadline ──────────────────────────────────────
    if (delayMs <= 0) {
      this.logger.warn('Deadline already passed — executing immediately', {
        <entityId>,
      });
      void this.execute(<entityId>);
      return;
    }

    // ── Schedule delayed execution ─────────────────────────────────────────
    const timer = setTimeout(() => {
      void this.execute(<entityId>);
      this.scheduledJobs.delete(<entityId>);
    }, delayMs);

    this.scheduledJobs.set(<entityId>, timer);

    this.logger.log('<JobName> scheduled', {
      <entityId>,
      deadline:  <deadline>,
      delayMs,
    });
  }

  // ── Execute the scheduled job ──────────────────────────────────────────
  private async execute(<entityId>: string): Promise<void> {
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.log('<JobName> executing', { jobId, <entityId> });

    try {
      await this.<name>Service.<actionMethod>(<entityId>);

      this.logger.log('<JobName> completed', {
        jobId,
        <entityId>,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      this.logger.error('<JobName> failed', {
        jobId,
        <entityId>,
        error:     (error as Error).message,
        stack:     (error as Error).stack,
      });

      // [DECISION NEEDED]: When queue system added —
      // rethrow here so queue retry policy handles it
      // For now: log and alert — timer cannot retry automatically
    }
  }

  // ── Cancel a scheduled job (e.g. payment received before deadline) ─────
  cancel(<entityId>: string): void {
    const timer = this.scheduledJobs.get(<entityId>);
    if (timer) {
      clearTimeout(timer);
      this.scheduledJobs.delete(<entityId>);
      this.logger.log('<JobName> cancelled', { <entityId> });
    }
  }
}
```

---

## Step 4 — Real Implementations Reference

### AuctionClosedHandler
```typescript
// src/modules/auctions/handlers/auction-closed.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import { AuctionClosedPayload } from '@common/events/event-payloads.type';
import { AuctionsService } from '../auctions.service';
import { AuctionStatus } from '@common/enums/auction-status.enum';

@Injectable()
export class AuctionClosedHandler {
  private readonly logger = new Logger(AuctionClosedHandler.name);

  constructor(private readonly auctionsService: AuctionsService) {}

  @OnEvent(EventNames.AUCTION_CLOSED, { async: true })
  async handle(payload: AuctionClosedPayload): Promise<void> {
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.log('Handling auction.closed', {
      jobId,
      auctionId:     payload.auctionId,
      winnerId:      payload.winnerId,
      winningAmount: payload.winningAmount,
    });

    try {
      const auction = await this.auctionsService.findById(
        payload.auctionId,
      );

      // Idempotency — only proceed if in CLOSED state
      if (auction.status !== AuctionStatus.CLOSED) {
        this.logger.warn('Skipping auction.closed — not in CLOSED state', {
          jobId,
          auctionId:     payload.auctionId,
          currentStatus: auction.status,
        });
        return;
      }

      // Thin orchestrator — delegate to service
      await this.auctionsService.startPaymentWindow(payload.auctionId);

      this.logger.log('auction.closed handled', {
        jobId,
        auctionId:  payload.auctionId,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      this.logger.error('Failed to handle auction.closed', {
        jobId,
        auctionId: payload.auctionId,
        error:     (error as Error).message,
        stack:     (error as Error).stack,
      });
      throw error;
    }
  }
}
```

### PaymentWindowExpiredHandler
```typescript
// src/modules/auctions/handlers/payment-window-expired.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import { PaymentWindowExpiredPayload } from '@common/events/event-payloads.type';
import { AuctionsService } from '../auctions.service';
import { AuctionStatus } from '@common/enums/auction-status.enum';

@Injectable()
export class PaymentWindowExpiredHandler {
  private readonly logger = new Logger(PaymentWindowExpiredHandler.name);

  constructor(private readonly auctionsService: AuctionsService) {}

  @OnEvent(EventNames.PAYMENT_WINDOW_EXPIRED, { async: true })
  async handle(payload: PaymentWindowExpiredPayload): Promise<void> {
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.warn('Handling payment.window.expired', {
      jobId,
      auctionId:        payload.auctionId,
      defaultedUserId:  payload.defaultedUserId,
    });

    try {
      const auction = await this.auctionsService.findById(
        payload.auctionId,
      );

      // Idempotency — only process if in correct state
      if (
        auction.status !== AuctionStatus.AWAITING_PAYMENT &&
        auction.status !== AuctionStatus.PAYMENT_FAILED
      ) {
        this.logger.warn(
          'Skipping payment.window.expired — invalid state',
          {
            jobId,
            auctionId:     payload.auctionId,
            currentStatus: auction.status,
          },
        );
        return;
      }

      await this.auctionsService.processPaymentExpiry(payload.auctionId);

      this.logger.log('payment.window.expired handled', {
        jobId,
        auctionId:  payload.auctionId,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      this.logger.error('Failed to handle payment.window.expired', {
        jobId,
        auctionId: payload.auctionId,
        error:     (error as Error).message,
        stack:     (error as Error).stack,
      });
      throw error;
    }
  }
}
```

---

## Step 5 — Register in Feature Module

```typescript
// src/modules/<name>/<name>.module.ts
import { Module } from '@nestjs/common';
import { <Name>Controller } from './<name>.controller';
import { <Name>Service } from './<name>.service';
import { <Name>Repository } from './<name>.repository';

// ── Import handlers and processors ────────────────────────────────────
import { <EventName>Handler } from './handlers/<event-name>.handler';
import { <JobName>Processor } from './processors/<job-name>.processor';

@Module({
  imports: [...],
  controllers: [<Name>Controller],
  providers: [
    <Name>Service,
    <Name>Repository,

    // ── Handlers — must be providers to receive @OnEvent ────────────────
    <EventName>Handler,

    // ── Processors — must be providers to receive @OnEvent ──────────────
    <JobName>Processor,
  ],
  exports: [<Name>Service],
})
export class <Name>Module {}
```

---

## Step 6 — Unit Test for Handler

```typescript
// src/modules/<name>/handlers/<event-name>.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { <EventName>Handler } from './<event-name>.handler';
import { <Name>Service } from '../<name>.service';
import { <Name>Status } from '@common/enums/<name>-status.enum';
import { create<Name>Entity } from '@test/factories/<name>.factory';

// ── Mocks — module scope ───────────────────────────────────────────────
const mock<Name>Service = {
  findById:      jest.fn(),
  <actionMethod>: jest.fn(),
};

describe('<EventName>Handler', () => {
  let handler: <EventName>Handler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <EventName>Handler,
        { provide: <Name>Service, useValue: mock<Name>Service },
      ],
    }).compile();

    handler = module.get<<EventName>Handler>(<EventName>Handler);
  });

  afterEach(() => jest.clearAllMocks());

  describe('handle', () => {
    const validPayload = {
      <entityId>: 'test-entity-id',
      // Add other required payload fields
    };

    // ── Happy path ─────────────────────────────────────────────────────
    it('should call service action when entity is in expected state',
      async () => {
        const entity = create<Name>Entity({
          id:     validPayload.<entityId>,
          status: <Name>Status.<EXPECTED_STATUS>,
        });
        mock<Name>Service.findById.mockResolvedValue(entity);
        mock<Name>Service.<actionMethod>.mockResolvedValue(undefined);

        await handler.handle(validPayload);

        expect(mock<Name>Service.<actionMethod>)
          .toHaveBeenCalledWith(validPayload.<entityId>);
      },
    );

    // ── Idempotency ────────────────────────────────────────────────────
    it('should skip processing when entity is already in different state',
      async () => {
        const entity = create<Name>Entity({
          id:     validPayload.<entityId>,
          status: <Name>Status.<ALREADY_PROCESSED_STATUS>,
        });
        mock<Name>Service.findById.mockResolvedValue(entity);

        await handler.handle(validPayload);

        // Service action must NOT be called for already-processed events
        expect(mock<Name>Service.<actionMethod>).not.toHaveBeenCalled();
      },
    );

    // ── Error propagation ──────────────────────────────────────────────
    it('should rethrow errors from service', async () => {
      const entity = create<Name>Entity({
        status: <Name>Status.<EXPECTED_STATUS>,
      });
      mock<Name>Service.findById.mockResolvedValue(entity);
      mock<Name>Service.<actionMethod>.mockRejectedValue(
        new Error('Service failure'),
      );

      await expect(handler.handle(validPayload))
        .rejects.toThrow('Service failure');
    });

    // ── No business logic in handler ───────────────────────────────────
    it('should only call one service method — no business logic',
      async () => {
        const entity = create<Name>Entity({
          status: <Name>Status.<EXPECTED_STATUS>,
        });
        mock<Name>Service.findById.mockResolvedValue(entity);
        mock<Name>Service.<actionMethod>.mockResolvedValue(undefined);

        await handler.handle(validPayload);

        // Handler should only call findById + one action method
        expect(mock<Name>Service.findById).toHaveBeenCalledTimes(1);
        expect(mock<Name>Service.<actionMethod>).toHaveBeenCalledTimes(1);
      },
    );
  });
});
```

---

## Step 7 — Unit Test for Processor

```typescript
// src/modules/<name>/processors/<job-name>.processor.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { <JobName>Processor } from './<job-name>.processor';
import { <Name>Service } from '../<name>.service';
import { EventNames } from '@common/events/event-names';

const mock<Name>Service = {
  findById:      jest.fn(),
  <actionMethod>: jest.fn(),
};

const mockEventEmitter = { emit: jest.fn() };

describe('<JobName>Processor', () => {
  let processor: <JobName>Processor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <JobName>Processor,
        { provide: <Name>Service,  useValue: mock<Name>Service },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    processor = module.get<<JobName>Processor>(<JobName>Processor);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('schedule', () => {
    it('should schedule job for future deadline', () => {
      jest.useFakeTimers();

      const futureDeadline = new Date(Date.now() + 18 * 60 * 60 * 1000);
      processor.schedule({
        <entityId>: 'test-id',
        <deadline>: futureDeadline,
      });

      // Job should not execute immediately
      expect(mock<Name>Service.<actionMethod>).not.toHaveBeenCalled();

      // Advance time to deadline
      jest.advanceTimersByTime(18 * 60 * 60 * 1000 + 100);

      // Now it should have executed
      expect(mock<Name>Service.<actionMethod>).toHaveBeenCalledWith('test-id');
    });

    it('should execute immediately when deadline already passed', async () => {
      const pastDeadline = new Date(Date.now() - 1000);
      mock<Name>Service.<actionMethod>.mockResolvedValue(undefined);

      processor.schedule({
        <entityId>: 'test-id',
        <deadline>: pastDeadline,
      });

      // Allow async execute to run
      await Promise.resolve();

      expect(mock<Name>Service.<actionMethod>).toHaveBeenCalledWith('test-id');
    });

    it('should clear existing timer when rescheduled', () => {
      jest.useFakeTimers();

      const deadline1 = new Date(Date.now() + 18 * 60 * 60 * 1000);
      const deadline2 = new Date(Date.now() + 36 * 60 * 60 * 1000);

      processor.schedule({ <entityId>: 'test-id', <deadline>: deadline1 });
      processor.schedule({ <entityId>: 'test-id', <deadline>: deadline2 });

      // Advance past first deadline
      jest.advanceTimersByTime(18 * 60 * 60 * 1000 + 100);

      // Should NOT have executed — timer was replaced
      expect(mock<Name>Service.<actionMethod>).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel a scheduled job', () => {
      jest.useFakeTimers();

      const deadline = new Date(Date.now() + 18 * 60 * 60 * 1000);
      processor.schedule({ <entityId>: 'test-id', <deadline>: deadline });
      processor.cancel('test-id');

      jest.advanceTimersByTime(18 * 60 * 60 * 1000 + 100);

      // Should NOT have executed after cancellation
      expect(mock<Name>Service.<actionMethod>).not.toHaveBeenCalled();
    });

    it('should not throw when cancelling non-existent job', () => {
      expect(() => processor.cancel('non-existent-id')).not.toThrow();
    });
  });
});
```

---

## Step 8 — Handler Rules Summary

```typescript
// ✅ Handlers must always:
// 1. Generate jobId = uuidv4() — CLS requestId is null in async context
// 2. Perform idempotency check before ANY action
// 3. Be thin orchestrators — call one service method, nothing else
// 4. Log start with jobId and key payload fields
// 5. Log success with jobId and durationMs
// 6. Log error with jobId, message, and stack
// 7. Rethrow errors — never swallow
// 8. Be registered as providers in feature module

// ❌ Handlers must never:
// - Contain business logic (belongs in service)
// - Access repository directly (goes through service)
// - Silently catch and swallow exceptions
// - Emit new events (service does this)
// - Use CLS context (not available in async — use jobId)
// - Process events without idempotency check
```

---

## Step 9 — Final Checklist

  ✅ EventNames constant exists for this event
  ✅ Payload type defined in event-payloads.type.ts
  ✅ Handler file: <event-name>.handler.ts
  ✅ Processor file: <job-name>.processor.ts (if timer needed)
  ✅ Handler generates jobId = uuidv4()
  ✅ Handler has idempotency check before any action
  ✅ Handler logs start, success, and error with jobId
  ✅ Handler calls service method — no business logic
  ✅ Handler never swallows errors — always rethrows
  ✅ Processor tracks scheduled timers in Map
  ✅ Processor prevents duplicate scheduling
  ✅ Processor handles already-past deadlines
  ✅ Processor has cancel() method
  ✅ Handler registered as provider in feature module
  ✅ Processor registered as provider in feature module
  ✅ Unit test covers happy path
  ✅ Unit test covers idempotency skip case
  ✅ Unit test covers error rethrow case
  ✅ Processor tests use jest.useFakeTimers()
  ✅ jest.useRealTimers() called in afterEach
  ✅ npm run lint — zero errors
  ✅ npm run build — zero TypeScript errors
  ✅ npm run test — all handler tests pass