# Events & Queues Reference

> Read this before writing any event handler, job processor,
> event emitter call, or any async operation.
> All event names must come from EventNames constants — never raw strings.
> All handlers must be idempotent — processing the same event twice
> must never cause duplicate side effects.

---

## Current Setup — Interim EventEmitter

The current setup uses NestJS EventEmitter (@nestjs/event-emitter)
as an interim in-process solution until the queue system is decided.

[DECISION NEEDED]: Replace EventEmitter with one of:
  Option A — BullMQ (recommended — Redis-based, NestJS native)
  Option B — RabbitMQ (@nestjs/microservices)
  Option C — Kafka (@nestjs/microservices)

See SKILL.md Section 7 — Open Decisions Log for status.

Design Rule: All event emission and handling is abstracted behind
a consistent pattern so the underlying system can be swapped
without rewriting handlers. Follow the patterns below exactly.

---

## Event Names — Single Source of Truth

```typescript
// src/common/events/event-names.ts
// Never use raw event name strings anywhere in the codebase.
// Always import from here.

export const EventNames = {
  // ── Bid Events ───────────────────────────────────────────────────────
  BID_SUBMITTED:           'bid.submitted',
  BID_ACCEPTED:            'bid.accepted',
  BID_REJECTED:            'bid.rejected',

  // ── Auction Lifecycle Events ─────────────────────────────────────────
  AUCTION_ACTIVATED:       'auction.activated',    // First bid placed
  AUCTION_CLOSED:          'auction.closed',        // Timer expired
  AUCTION_SETTLED:         'auction.settled',       // Payment confirmed
  AUCTION_ABANDONED:       'auction.abandoned',     // All bidders defaulted

  // ── Payment Events ───────────────────────────────────────────────────
  PAYMENT_WINDOW_STARTED:  'payment.window.started',
  PAYMENT_WINDOW_EXPIRED:  'payment.window.expired',
  PAYMENT_CONFIRMED:       'payment.confirmed',

  // ── User Events ──────────────────────────────────────────────────────
  USER_LOGIN:              'user.login',
  USER_LOGIN_FAILED:       'user.login.failed',
  USER_ACCOUNT_LOCKED:     'user.account.locked',
} as const;

export type EventName = typeof EventNames[keyof typeof EventNames];
```

---

## Event Payload Types

```typescript
// src/common/events/event-payloads.type.ts
// Every event has a typed payload — never use untyped objects

export interface BidSubmittedPayload {
  bidId: string;
  auctionId: string;
  userId: string;
  amount: number;
}

export interface BidAcceptedPayload {
  bidId: string;
  auctionId: string;
  userId: string;
  amount: number;
  newLeadingBid: number;
}

export interface BidRejectedPayload {
  bidId: string;
  auctionId: string;
  userId: string;
  reason: string;
  errorCode: string;
}

export interface AuctionActivatedPayload {
  auctionId: string;
  firstBidAt: Date;
  closesAt: Date;
}

export interface AuctionClosedPayload {
  auctionId: string;
  closedAt: Date;
  winnerId: string | null;
  winningAmount: number | null;
  totalBids: number;
}

export interface AuctionSettledPayload {
  auctionId: string;
  winnerId: string;
  finalAmount: number;
  settledAt: Date;
}

export interface AuctionAbandonedPayload {
  auctionId: string;
  abandonedAt: Date;
  totalBidders: number;
}

export interface PaymentWindowStartedPayload {
  auctionId: string;
  winnerId: string;
  paymentDeadline: Date;
}

export interface PaymentWindowExpiredPayload {
  auctionId: string;
  defaultedUserId: string;
  nextBidderId: string | null;
}

export interface PaymentConfirmedPayload {
  auctionId: string;
  userId: string;
  amount: number;
  confirmedAt: Date;
}
```

---

## Event Emission Pattern

```typescript
// ✅ Always emit with typed payload — never raw objects
// ✅ Always use EventNames constants — never raw strings
// ✅ Emit AFTER successful DB operation — never before

import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventNames } from '@common/events/event-names';
import { BidAcceptedPayload } from '@common/events/event-payloads.type';

@Injectable()
export class BidsService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async placeBid(dto: CreateBidDto): Promise<BidEntity> {
    // 1. DB operation first
    const bid = await this.placeBidTransaction(dto);

    // 2. Emit event AFTER successful DB operation
    const payload: BidAcceptedPayload = {
      bidId: bid.id,
      auctionId: dto.auctionId,
      userId: bid.bidder.id,
      amount: parseFloat(bid.amount),
      newLeadingBid: parseFloat(bid.amount),
    };

    this.eventEmitter.emit(EventNames.BID_ACCEPTED, payload);

    return bid;
  }
}

// ❌ Never emit before DB operation succeeds
this.eventEmitter.emit(EventNames.BID_ACCEPTED, payload);  // Wrong order
const bid = await this.placeBidTransaction(dto);           // Wrong order

// ❌ Never use raw event name strings
this.eventEmitter.emit('bid.accepted', payload);           // Use EventNames.BID_ACCEPTED
```

---

## Event Handler Pattern

```typescript
// src/modules/auctions/handlers/auction-closed.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import { AuctionClosedPayload } from '@common/events/event-payloads.type';
import { AuctionsService } from '../auctions.service';

@Injectable()
export class AuctionClosedHandler {
  private readonly logger = new Logger(AuctionClosedHandler.name);

  constructor(private readonly auctionsService: AuctionsService) {}

  @OnEvent(EventNames.AUCTION_CLOSED, { async: true })
  async handle(payload: AuctionClosedPayload): Promise<void> {
    // Always generate jobId for async context tracing
    const jobId = uuidv4();

    this.logger.log('Handling auction.closed event', {
      jobId,
      auctionId: payload.auctionId,
      winnerId: payload.winnerId,
    });

    try {
      // ── Idempotency check ────────────────────────────────────────────
      // Always check current state before acting
      // Re-processing same event must not cause duplicate side effects
      const auction = await this.auctionsService.findById(
        payload.auctionId,
      );

      if (auction.status !== AuctionStatus.CLOSED) {
        this.logger.warn('Skipping auction.closed — already processed', {
          jobId,
          auctionId: payload.auctionId,
          currentStatus: auction.status,
        });
        return;
      }

      // ── Handler is a thin orchestrator — call service, nothing else ──
      await this.auctionsService.startPaymentWindow(payload.auctionId);

      this.logger.log('auction.closed handled successfully', {
        jobId,
        auctionId: payload.auctionId,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      // ── Never swallow errors in handlers ────────────────────────────
      this.logger.error('Failed to handle auction.closed event', {
        jobId,
        auctionId: payload.auctionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      // Rethrow so EventEmitter can handle retry (when queue added)
      throw error;
    }
  }
}
```

---

## Payment Window Handler

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

    this.logger.warn('Handling payment.window.expired event', {
      jobId,
      auctionId: payload.auctionId,
      defaultedUserId: payload.defaultedUserId,
      nextBidderId: payload.nextBidderId,
    });

    try {
      // Idempotency check
      const auction = await this.auctionsService.findById(
        payload.auctionId,
      );

      if (
        auction.status !== AuctionStatus.AWAITING_PAYMENT &&
        auction.status !== AuctionStatus.PAYMENT_FAILED
      ) {
        this.logger.warn(
          'Skipping payment.window.expired — invalid state',
          {
            jobId,
            auctionId: payload.auctionId,
            currentStatus: auction.status,
          },
        );
        return;
      }

      await this.auctionsService.processPaymentExpiry(payload.auctionId);

      this.logger.log('payment.window.expired handled', {
        jobId,
        auctionId: payload.auctionId,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      this.logger.error('Failed to handle payment.window.expired', {
        jobId,
        auctionId: payload.auctionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
```

---

## Scheduled Jobs — Auction Close Timer

```typescript
// src/modules/auctions/processors/auction-close.processor.ts
// Handles scheduling auction close after first bid placed
// Uses setTimeout as interim — replace with BullMQ delayed job when decided

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import { AuctionActivatedPayload } from '@common/events/event-payloads.type';
import { AuctionsService } from '../auctions.service';

@Injectable()
export class AuctionCloseProcessor {
  private readonly logger = new Logger(AuctionCloseProcessor.name);
  // Track scheduled timers — prevent duplicate scheduling
  private readonly scheduledClosings = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly auctionsService: AuctionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Called when auction.activated event fires
  scheduleClose(payload: AuctionActivatedPayload): void {
    const { auctionId, closesAt } = payload;

    // Prevent duplicate scheduling
    if (this.scheduledClosings.has(auctionId)) {
      this.logger.warn('Auction close already scheduled — skipping', {
        auctionId,
      });
      return;
    }

    const delayMs = closesAt.getTime() - Date.now();
    if (delayMs <= 0) {
      this.logger.warn('Auction closesAt is in the past — closing now', {
        auctionId,
      });
      void this.executeClose(auctionId);
      return;
    }

    const timer = setTimeout(() => {
      void this.executeClose(auctionId);
      this.scheduledClosings.delete(auctionId);
    }, delayMs);

    this.scheduledClosings.set(auctionId, timer);

    this.logger.log('Auction close scheduled', {
      auctionId,
      closesAt,
      delayMs,
    });
  }

  private async executeClose(auctionId: string): Promise<void> {
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.log('Executing auction close', { jobId, auctionId });

    try {
      await this.auctionsService.closeAuction(auctionId);

      this.logger.log('Auction close executed', {
        jobId,
        auctionId,
        durationMs: Date.now() - startTime,
      });

    } catch (error) {
      this.logger.error('Auction close failed', {
        jobId,
        auctionId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    }
  }
}
```

---

## Payment Window Timer Processor

```typescript
// src/modules/auctions/processors/payment-window.processor.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import { PaymentWindowStartedPayload } from '@common/events/event-payloads.type';

@Injectable()
export class PaymentWindowProcessor {
  private readonly logger = new Logger(PaymentWindowProcessor.name);
  private readonly scheduledWindows = new Map<string, NodeJS.Timeout>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  schedulePaymentWindowExpiry(
    payload: PaymentWindowStartedPayload,
  ): void {
    const { auctionId, winnerId, paymentDeadline } = payload;

    // Clear existing timer if promoting to next bidder
    if (this.scheduledWindows.has(auctionId)) {
      clearTimeout(this.scheduledWindows.get(auctionId)!);
      this.scheduledWindows.delete(auctionId);
    }

    const delayMs = paymentDeadline.getTime() - Date.now();
    if (delayMs <= 0) {
      this.logger.warn('Payment deadline already passed — expiring now', {
        auctionId,
        winnerId,
      });
      this.emitExpiry(auctionId, winnerId);
      return;
    }

    const timer = setTimeout(() => {
      this.emitExpiry(auctionId, winnerId);
      this.scheduledWindows.delete(auctionId);
    }, delayMs);

    this.scheduledWindows.set(auctionId, timer);

    this.logger.log('Payment window timer scheduled', {
      auctionId,
      winnerId,
      paymentDeadline,
      delayMs,
    });
  }

  private emitExpiry(auctionId: string, defaultedUserId: string): void {
    this.logger.warn('Payment window expired — emitting event', {
      auctionId,
      defaultedUserId,
    });

    this.eventEmitter.emit(EventNames.PAYMENT_WINDOW_EXPIRED, {
      auctionId,
      defaultedUserId,
      nextBidderId: null,    // Resolved in AuctionsService
    });
  }
}
```

---

## Registering Handlers in Module

```typescript
// src/modules/auctions/auctions.module.ts
import { Module } from '@nestjs/common';
import { AuctionsController } from './auctions.controller';
import { AuctionsService } from './auctions.service';
import { AuctionsRepository } from './auctions.repository';
import { AuctionClosedHandler } from './handlers/auction-closed.handler';
import { PaymentWindowExpiredHandler } from './handlers/payment-window-expired.handler';
import { AuctionCloseProcessor } from './processors/auction-close.processor';
import { PaymentWindowProcessor } from './processors/payment-window.processor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionEntity } from './entities/auction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuctionEntity])],
  controllers: [AuctionsController],
  providers: [
    AuctionsService,
    AuctionsRepository,
    // Handlers — must be registered as providers to receive events
    AuctionClosedHandler,
    PaymentWindowExpiredHandler,
    // Processors — job schedulers
    AuctionCloseProcessor,
    PaymentWindowProcessor,
  ],
  exports: [AuctionsService],
})
export class AuctionsModule {}
```

---

## Async Operations Summary

| Operation | Sync/Async | Trigger | Handler |
|---|---|---|---|
| Bid placement validation | Sync | HTTP POST /bids | BidsService |
| Auction activation (first bid) | Sync | BidsService | AuctionsService |
| Schedule auction close timer | Async | auction.activated event | AuctionCloseProcessor |
| Close auction | Async | Timer fires | AuctionsService.closeAuction |
| Start payment window | Async | auction.closed event | AuctionClosedHandler |
| Schedule payment expiry timer | Async | payment.window.started | PaymentWindowProcessor |
| Process payment expiry | Async | Timer fires | PaymentWindowExpiredHandler |
| Promote next bidder | Async | payment.window.expired | AuctionsService |
| Settle auction | Sync | Payment service call | AuctionsService.confirmPayment |

---

## Handler Rules — Non-Negotiable

```typescript
// ✅ Handlers must always:

// 1. Generate a jobId for tracing
const jobId = uuidv4();

// 2. Check current state before acting (idempotency)
if (auction.status !== expectedStatus) { return; }

// 3. Be thin orchestrators — call service, nothing else
await this.service.doSomething(payload.id);

// 4. Log start, success, and failure with jobId
this.logger.log('Handler started', { jobId, ... });
this.logger.log('Handler completed', { jobId, durationMs });
this.logger.error('Handler failed', { jobId, error });

// 5. Never swallow errors — always rethrow
catch (error) { throw error; }

// ❌ Handlers must never:
// - Contain business logic (belongs in service)
// - Access repository directly (goes through service)
// - Silently swallow exceptions
// - Emit new events directly (service does this)
// - Assume CLS context is available (use jobId instead)
```

---

## Migration Path — EventEmitter to Queue System

When queue system is decided, follow this migration path: