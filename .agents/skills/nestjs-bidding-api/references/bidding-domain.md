# Bidding Domain Reference

> Read this before writing ANY business logic related to bids,
> auctions, payments, or state transitions.
> This is the most critical reference — it is the executable
> version of Rule 3. Every domain rule is enforced here.
> When in doubt about domain logic — this file wins.

---

## Domain Overview

- English auction — highest bid wins.
- Auction closes X hours after the first bid is placed.
- Payment window: 18 hours after auction closes.
- If winner fails to pay → fallback to next highest bidder.
- If all bidders fail → auction moves to ABANDONED.

---

## State Machines

### Bid State Machine
DRAFT → SUBMITTED → ACCEPTED
→ REJECTED
| State | Description | Mutable? |
|---|---|---|
| DRAFT | Created but not submitted | ✅ Yes |
| SUBMITTED | Placed — pending validation | ❌ No |
| ACCEPTED | Valid — current or past leading bid | ❌ No |
| REJECTED | Failed validation | ❌ No |
| PAYMENT_DEFAULTED | Winner failed to pay | ❌ No |

### Auction State Machine
PENDING → ACTIVE → CLOSED → AWAITING_PAYMENT → SETTLED
→ PAYMENT_FAILED → AWAITING_PAYMENT (next bidder)
→ ABANDONED (no bidders left)
| State | Description | Trigger |
|---|---|---|
| PENDING | Created — no bids placed | Auction created |
| ACTIVE | First bid placed — timer started | First bid submitted |
| CLOSED | Timer expired — no more bids | Scheduled job fires at closesAt |
| AWAITING_PAYMENT | Winner notified — 18hr window started | auction.closed event |
| SETTLED | Payment confirmed — winner finalized | Payment service confirms |
| PAYMENT_FAILED | Payment window expired — fallback triggered | payment.window.expired event |
| ABANDONED | All bidders defaulted — no winner | NoRemainingBiddersException caught |

### State Transition Rules
- Forward only — no backward transitions ever.
- Transitions validated in AuctionsService before persisting.
- Throw InvalidAuctionStateException for invalid transitions.
- All transitions emit a corresponding domain event.

```typescript
// src/common/constants/auction-transitions.ts
// Defines all valid state transitions — enforced by AuctionsService
export const VALID_AUCTION_TRANSITIONS: Record
  AuctionStatus,
  AuctionStatus[]
> = {
  [AuctionStatus.PENDING]:          [AuctionStatus.ACTIVE],
  [AuctionStatus.ACTIVE]:           [AuctionStatus.CLOSED],
  [AuctionStatus.CLOSED]:           [AuctionStatus.AWAITING_PAYMENT],
  [AuctionStatus.AWAITING_PAYMENT]: [
    AuctionStatus.SETTLED,
    AuctionStatus.PAYMENT_FAILED,
  ],
  [AuctionStatus.PAYMENT_FAILED]:   [
    AuctionStatus.AWAITING_PAYMENT,  // Next bidder promoted
    AuctionStatus.ABANDONED,          // No bidders left
  ],
  [AuctionStatus.SETTLED]:          [],  // Terminal state
  [AuctionStatus.ABANDONED]:        [],  // Terminal state
};
```

---

## Enums

```typescript
// src/common/enums/bid-status.enum.ts
export enum BidStatus {
  DRAFT             = 'DRAFT',
  SUBMITTED         = 'SUBMITTED',
  ACCEPTED          = 'ACCEPTED',
  REJECTED          = 'REJECTED',
  PAYMENT_DEFAULTED = 'PAYMENT_DEFAULTED',
}

// src/common/enums/auction-status.enum.ts
export enum AuctionStatus {
  PENDING           = 'PENDING',
  ACTIVE            = 'ACTIVE',
  CLOSED            = 'CLOSED',
  AWAITING_PAYMENT  = 'AWAITING_PAYMENT',
  SETTLED           = 'SETTLED',
  PAYMENT_FAILED    = 'PAYMENT_FAILED',
  ABANDONED         = 'ABANDONED',
}
```

---

## Domain Constants

```typescript
// src/common/constants/domain.constants.ts
// All domain constants — always access via ConfigService in services
// These are defaults — actual values come from environment config

export const DOMAIN_DEFAULTS = {
  PAYMENT_WINDOW_HOURS: 18,    // Fixed — do not change without rule update
  AUCTION_DURATION_HOURS: 24,  // [DECISION NEEDED] default duration
  MIN_BID_INCREMENT: 0,        // [DECISION NEEDED] 0 = no increment rule
  MAX_BID_AMOUNT: 1_000_000,   // Safety cap — configurable
  MIN_BID_AMOUNT: 0.01,        // Minimum any bid can be
  MAX_AUCTION_DURATION_HOURS: 168,  // 7 days maximum
} as const;
```

---

## Entities

### BidEntity
```typescript
// src/modules/bids/entities/bid.entity.ts
import {
  Entity, Column, ManyToOne,
  JoinColumn, Index,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { BidStatus } from '@common/enums/bid-status.enum';
import { UserEntity } from '@modules/users/entities/user.entity';
import { AuctionEntity } from '@modules/auctions/entities/auction.entity';

@Entity('bids')
export class BidEntity extends BaseEntity {
  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  amount: string;                  // TypeORM returns decimal as string

  @Column({
    name: 'status',
    type: 'enum',
    enum: BidStatus,
    default: BidStatus.SUBMITTED,
  })
  status: BidStatus;

  @Column({
    name: 'submitted_at',
    type: 'timestamptz',
    nullable: true,
  })
  submittedAt: Date | null;

  // Fallback chain rank — set when auction closes
  // Lower rank = higher priority in fallback chain
  @Column({
    name: 'fallback_rank',
    type: 'int',
    nullable: true,
  })
  fallbackRank: number | null;

  @ManyToOne(() => AuctionEntity, (auction) => auction.bids, {
    nullable: false,
  })
  @JoinColumn({ name: 'auction_id' })
  @Index('idx_bids_auction_id')
  auction: AuctionEntity;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'bidder_id' })
  @Index('idx_bids_bidder_id')
  bidder: UserEntity;
}
```

### AuctionEntity
```typescript
// src/modules/auctions/entities/auction.entity.ts
import {
  Entity, Column, ManyToOne, OneToMany,
  JoinColumn, Index,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { AuctionStatus } from '@common/enums/auction-status.enum';
import { UserEntity } from '@modules/users/entities/user.entity';
import { BidEntity } from '@modules/bids/entities/bid.entity';

@Entity('auctions')
export class AuctionEntity extends BaseEntity {
  @Column({
    name: 'title',
    type: 'varchar',
    length: 255,
  })
  title: string;

  @Column({
    name: 'description',
    type: 'text',
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'starting_price',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  startingPrice: string;

  @Column({
    name: 'current_highest_bid',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  currentHighestBid: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.PENDING,
  })
  @Index('idx_auctions_status')
  status: AuctionStatus;

  @Column({
    name: 'duration_hours',
    type: 'int',
  })
  durationHours: number;          // X hours from first bid

  @Column({
    name: 'first_bid_at',
    type: 'timestamptz',
    nullable: true,
  })
  firstBidAt: Date | null;        // Set when PENDING → ACTIVE

  @Column({
    name: 'closes_at',
    type: 'timestamptz',
    nullable: true,
  })
  @Index('idx_auctions_closes_at')
  closesAt: Date | null;           // firstBidAt + durationHours

  @Column({
    name: 'payment_deadline',
    type: 'timestamptz',
    nullable: true,
  })
  paymentDeadline: Date | null;    // closedAt + PAYMENT_WINDOW_HOURS

  @Column({
    name: 'current_winner_id',
    type: 'uuid',
    nullable: true,
  })
  currentWinnerId: string | null;  // Updated on each fallback

  @Column({
    name: 'settled_at',
    type: 'timestamptz',
    nullable: true,
  })
  settledAt: Date | null;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'owner_id' })
  @Index('idx_auctions_owner_id')
  owner: UserEntity;

  @OneToMany(() => BidEntity, (bid) => bid.auction)
  bids: BidEntity[];
}
```

---

## BidsService — Full Bid Placement Logic

```typescript
// src/modules/bids/bids.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BidsRepository } from './bids.repository';
import { AuctionsRepository } from '@modules/auctions/auctions.repository';
import { CreateBidDto } from './dto/create-bid.dto';
import { BidEntity } from './entities/bid.entity';
import { BidStatus } from '@common/enums/bid-status.enum';
import { AuctionStatus } from '@common/enums/auction-status.enum';
import { EventNames } from '@common/events/event-names';
import {
  AuctionNotFoundException,
  AuctionNotActiveException,
  AuctionClosedException,
  SelfBiddingException,
  DuplicateLeadingBidException,
  BidBelowMinimumException,
  BidIncrementViolationException,
} from '@common/exceptions';

@Injectable()
export class BidsService {
  private readonly logger = new Logger(BidsService.name);

  constructor(
    private readonly bidsRepository: BidsRepository,
    private readonly auctionsRepository: AuctionsRepository,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async placeBid(
    dto: CreateBidDto,
    userId: string,
  ): Promise<BidEntity> {
    // ── Step 1: Fetch auction ───────────────────────────────────────────
    const auction = await this.auctionsRepository.findById(dto.auctionId);
    if (!auction) throw new AuctionNotFoundException();

    // ── Step 2: Validate auction state ─────────────────────────────────
    if (auction.status !== AuctionStatus.ACTIVE &&
        auction.status !== AuctionStatus.PENDING) {
      throw new AuctionNotActiveException();
    }

    // ── Step 3: Validate auction not expired ───────────────────────────
    if (auction.closesAt && new Date() > auction.closesAt) {
      throw new AuctionClosedException();
    }

    // ── Step 4: Validate self-bidding ──────────────────────────────────
    if (auction.owner.id === userId) {
      throw new SelfBiddingException();
    }

    // ── Step 5: Validate duplicate leading bid ─────────────────────────
    const isDuplicateLeader = await this.bidsRepository
      .findBidderHasLeadingBid(dto.auctionId, userId);
    if (isDuplicateLeader) {
      throw new DuplicateLeadingBidException();
    }

    // ── Step 6: Validate bid amount ────────────────────────────────────
    const currentHighest = auction.currentHighestBid
      ? parseFloat(auction.currentHighestBid)
      : parseFloat(auction.startingPrice) - 0.01; // Allow first bid >= startingPrice

    const bidAmount = dto.amount;

    // Must be strictly above current highest
    if (bidAmount <= currentHighest) {
      throw new BidBelowMinimumException();
    }

    // Validate increment if configured
    const minIncrement = this.config.get<number>(
      'domain.minBidIncrement',
      0,
    );
    if (minIncrement > 0 && bidAmount < currentHighest + minIncrement) {
      throw new BidIncrementViolationException(minIncrement);
    }

    // ── Step 7: Place bid in transaction ───────────────────────────────
    const isFirstBid = auction.status === AuctionStatus.PENDING;
    const bid = await this.placeBidTransaction(
      dto,
      userId,
      auction,
      isFirstBid,
    );

    // ── Step 8: Emit domain events ─────────────────────────────────────
    this.eventEmitter.emit(EventNames.BID_ACCEPTED, {
      bidId: bid.id,
      auctionId: dto.auctionId,
      userId,
      amount: dto.amount,
    });

    if (isFirstBid) {
      this.eventEmitter.emit(EventNames.AUCTION_ACTIVATED, {
        auctionId: dto.auctionId,
        firstBidAt: bid.createdAt,
        closesAt: auction.closesAt,
      });
    }

    this.logger.log('Bid accepted', {
      bidId: bid.id,
      auctionId: dto.auctionId,
      userId,
      amount: dto.amount,
      requestId: this.cls.get('requestId'),
    });

    return bid;
  }

  private async placeBidTransaction(
    dto: CreateBidDto,
    userId: string,
    auction: AuctionEntity,
    isFirstBid: boolean,
  ): Promise<BidEntity> {
    const queryRunner = this.bidsRepository.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create bid record
      const bid = await this.bidsRepository.create(
        {
          amount: dto.amount.toString(),
          status: BidStatus.ACCEPTED,
          submittedAt: new Date(),
          auction: { id: dto.auctionId } as AuctionEntity,
          bidder: { id: userId } as UserEntity,
        },
        queryRunner,
      );

      // Calculate closesAt if first bid
      const now = new Date();
      const durationHours = auction.durationHours ??
        this.config.get<number>('domain.auctionDurationHours', 24);

      const closesAt = isFirstBid
        ? new Date(now.getTime() + durationHours * 60 * 60 * 1000)
        : auction.closesAt;

      // Update auction state
      await this.auctionsRepository.update(
        auction.id,
        {
          currentHighestBid: dto.amount.toString(),
          currentWinnerId: userId,
          status: isFirstBid ? AuctionStatus.ACTIVE : auction.status,
          firstBidAt: isFirstBid ? now : auction.firstBidAt,
          closesAt,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      return bid;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

---

## AuctionsService — State Transition Logic

```typescript
// src/modules/auctions/auctions.service.ts (partial — key methods)
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { AuctionsRepository } from './auctions.repository';
import { BidsRepository } from '@modules/bids/bids.repository';
import { AuctionStatus } from '@common/enums/auction-status.enum';
import { BidStatus } from '@common/enums/bid-status.enum';
import { EventNames } from '@common/events/event-names';
import { VALID_AUCTION_TRANSITIONS } from '@common/constants/auction-transitions';
import {
  AuctionNotFoundException,
  InvalidAuctionStateException,
  AuctionOwnershipException,
  NoRemainingBiddersException,
} from '@common/exceptions';
import { Role } from '@common/enums/role.enum';

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    private readonly auctionsRepository: AuctionsRepository,
    private readonly bidsRepository: BidsRepository,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── State Transition Helper ────────────────────────────────────────────
  async transitionState(
    auctionId: string,
    targetStatus: AuctionStatus,
    additionalData?: Partial<AuctionEntity>,
  ): Promise<AuctionEntity> {
    const auction = await this.auctionsRepository.findById(auctionId);
    if (!auction) throw new AuctionNotFoundException();

    const validNext = VALID_AUCTION_TRANSITIONS[auction.status];
    if (!validNext.includes(targetStatus)) {
      throw new InvalidAuctionStateException(auction.status, targetStatus);
    }

    return this.auctionsRepository.update(
      auctionId,
      { status: targetStatus, ...additionalData },
    );
  }

  // ── Close Auction (triggered by scheduled job) ─────────────────────────
  async closeAuction(auctionId: string): Promise<void> {
    const auction = await this.transitionState(
      auctionId,
      AuctionStatus.CLOSED,
    );

    // Lock fallback chain — rank all ACCEPTED bids
    await this.lockFallbackChain(auctionId);

    this.logger.log('Auction closed', {
      auctionId,
      totalBids: auction.bids?.length ?? 0,
      winnerId: auction.currentWinnerId,
      winningAmount: auction.currentHighestBid,
    });

    this.eventEmitter.emit(EventNames.AUCTION_CLOSED, {
      auctionId,
      closedAt: new Date(),
      winnerId: auction.currentWinnerId,
      winningAmount: auction.currentHighestBid,
    });
  }

  // ── Start Payment Window (triggered by auction.closed event) ───────────
  async startPaymentWindow(auctionId: string): Promise<void> {
    const paymentWindowHours = this.config.get<number>(
      'domain.paymentWindowHours',
      18,
    );
    const paymentDeadline = new Date(
      Date.now() + paymentWindowHours * 60 * 60 * 1000,
    );

    const auction = await this.transitionState(
      auctionId,
      AuctionStatus.AWAITING_PAYMENT,
      { paymentDeadline },
    );

    this.logger.log('Payment window started', {
      auctionId,
      winnerId: auction.currentWinnerId,
      paymentDeadline,
    });

    this.eventEmitter.emit(EventNames.PAYMENT_WINDOW_STARTED, {
      auctionId,
      winnerId: auction.currentWinnerId,
      paymentDeadline,
    });
  }

  // ── Process Payment Expiry (triggered by payment.window.expired event) ──
  async processPaymentExpiry(auctionId: string): Promise<void> {
    const auction = await this.auctionsRepository.findById(auctionId);
    if (!auction) throw new AuctionNotFoundException();

    // Mark current winner bid as PAYMENT_DEFAULTED
    if (auction.currentWinnerId) {
      await this.bidsRepository.markPaymentDefaulted(
        auctionId,
        auction.currentWinnerId,
      );

      this.logger.warn('Payment defaulted', {
        auctionId,
        defaultedUserId: auction.currentWinnerId,
      });
    }

    // Get next bidder in fallback chain
    const fallbackChain = await this.bidsRepository.findFallbackChain(
      auctionId,
    );

    // Filter out already defaulted bidders
    const nextBid = fallbackChain.find(
      (bid) => bid.status === BidStatus.ACCEPTED,
    );

    if (!nextBid) {
      // No remaining bidders — abandon auction
      await this.transitionState(auctionId, AuctionStatus.ABANDONED);

      this.logger.warn('Auction abandoned — no remaining bidders', {
        auctionId,
      });

      this.eventEmitter.emit(EventNames.AUCTION_ABANDONED, {
        auctionId,
        abandonedAt: new Date(),
      });
      return;
    }

    // Promote next bidder
    await this.transitionState(
      auctionId,
      AuctionStatus.PAYMENT_FAILED,
      { currentWinnerId: nextBid.bidder.id },
    );

    this.eventEmitter.emit(EventNames.PAYMENT_WINDOW_EXPIRED, {
      auctionId,
      defaultedUserId: auction.currentWinnerId,
      nextBidderId: nextBid.bidder.id,
    });

    // Start new payment window for next bidder
    await this.startPaymentWindow(auctionId);
  }

  // ── Confirm Payment (called by payment service) ─────────────────────────
  async confirmPayment(auctionId: string): Promise<void> {
    const auction = await this.transitionState(
      auctionId,
      AuctionStatus.SETTLED,
      { settledAt: new Date() },
    );

    this.logger.log('Auction settled', {
      auctionId,
      winnerId: auction.currentWinnerId,
      finalAmount: auction.currentHighestBid,
      settledAt: auction.settledAt,
    });

    this.eventEmitter.emit(EventNames.AUCTION_SETTLED, {
      auctionId,
      winnerId: auction.currentWinnerId,
      finalAmount: auction.currentHighestBid,
      settledAt: auction.settledAt,
    });
  }

  // ── Lock Fallback Chain ─────────────────────────────────────────────────
  private async lockFallbackChain(auctionId: string): Promise<void> {
    // Rank all ACCEPTED bids — highest amount first, earliest time as tiebreaker
    const bids = await this.bidsRepository.findFallbackChain(auctionId);

    // Assign fallback rank — immutable once set
    await Promise.all(
      bids.map((bid, index) =>
        this.bidsRepository.updateFallbackRank(bid.id, index + 1),
      ),
    );
  }
}
```

---

## Event Names

```typescript
// src/common/events/event-names.ts
export const EventNames = {
  // Bid events
  BID_SUBMITTED:          'bid.submitted',
  BID_ACCEPTED:           'bid.accepted',
  BID_REJECTED:           'bid.rejected',

  // Auction lifecycle events
  AUCTION_ACTIVATED:      'auction.activated',
  AUCTION_CLOSED:         'auction.closed',
  AUCTION_SETTLED:        'auction.settled',
  AUCTION_ABANDONED:      'auction.abandoned',

  // Payment events
  PAYMENT_WINDOW_STARTED: 'payment.window.started',
  PAYMENT_WINDOW_EXPIRED: 'payment.window.expired',
  PAYMENT_CONFIRMED:      'payment.confirmed',

  // User events
  USER_LOGIN:             'user.login',
  USER_LOGIN_FAILED:      'user.login.failed',
  USER_ACCOUNT_LOCKED:    'user.account.locked',
} as const;

export type EventName = typeof EventNames[keyof typeof EventNames];
```

---

## Bid Validation Rules Summary

A bid MUST be rejected if ANY of these conditions are true:

| Rule | Exception Thrown |
|---|---|
| Auction does not exist | `AuctionNotFoundException` |
| Auction status is not ACTIVE or PENDING | `AuctionNotActiveException` |
| Current time is past `closesAt` | `AuctionClosedException` |
| Bid amount ≤ current highest bid | `BidBelowMinimumException` |
| Bid amount < `startingPrice` | `BidBelowMinimumException` |
| Bidder is auction owner | `SelfBiddingException` |
| Bidder already holds highest bid | `DuplicateLeadingBidException` |
| Bid amount < currentHighest + minIncrement | `BidIncrementViolationException` |
| Bid amount is not a positive number | DTO validation — 400 |

---

## Immutability Rules

| Entity | Field(s) | Immutable After |
|---|---|---|
| BidEntity | `amount`, `status` (once ACCEPTED/REJECTED) | SUBMITTED |
| BidEntity | `fallbackRank` | Set when auction CLOSED |
| AuctionEntity | `startingPrice`, `durationHours` | ACTIVE |
| AuctionEntity | `closesAt`, `firstBidAt` | ACTIVE |
| AuctionEntity | Fallback chain (bids ranking) | CLOSED |
| AuctionEntity | `settledAt`, final `currentWinnerId` | SETTLED |

---

## Open Decisions

| # | Decision | Impact |
|---|---|---|
| 1 | Auction duration — fixed or configurable range | `durationHours` validation |
| 2 | Bid increment — fixed, percentage, or none | `BidIncrementViolationException` |
| 3 | Currency/decimal precision — max decimal places | DTO validation |
| 4 | Penalty for PAYMENT_DEFAULTED bidders | New service method needed |
| 5 | ABANDONED auction handling — relist, notify, manual? | New event handler needed |

Never implement logic for open decisions without surfacing
them to the user first — see SKILL.md Section 7.