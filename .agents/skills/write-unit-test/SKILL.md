---
name: write-unit-test
description: >
  Use this skill when the user asks to write unit tests for a service,
  guard, pipe, interceptor, or any injectable class. Triggers include:
  "write unit tests for X", "add tests for the bids service", "test this
  service method", "write tests for the auth service", "add unit tests for
  the permissions guard", "I need tests for placeBid", "cover all branches
  in the auction service". Always read this skill before writing any
  unit test file or adding test cases to an existing spec file.
---

# Skill: write-unit-test

## References — Read Before Starting

- [SKILL.md] — project context, open decisions
- [references/testing-standards.md] — ALL mock patterns, factory usage,
  forbidden patterns, coverage requirements
- [references/conventions.md] — test naming conventions
- [references/error-handling.md] — exception classes to assert
- [references/bidding-domain.md] — domain rules to test
- [references/cls-context.md] — how to mock ClsService
- [references/events-queues.md] — how to assert event emission

---

## Step 0 — Extract Test Details

Before writing any test confirm:

| Detail | Extract From Request |
|---|---|
| Class under test | Which service/guard/pipe? |
| Method(s) to test | Which specific methods? |
| Dependencies | What does the class inject? |
| Existing tests | Does a spec file already exist? |
| Coverage gaps | Which branches are not yet tested? |

If a spec file already exists — read it fully before adding tests.
Never duplicate existing test cases.
Never change existing mock definitions without checking all tests.

---

## Step 1 — Read the Source File First

Before writing any test always read the source file being tested:
- All constructor dependencies
- All public methods and their signatures
- All business rules and branches
- All exceptions that can be thrown
- All events that are emitted

Never write tests from memory — always read the actual implementation.

---

## Step 2 — Standard Test File Structure

```typescript
// src/modules/<name>/<name>.service.spec.ts

// ── Imports ────────────────────────────────────────────────────────────
import { Test, TestingModule } from '@nestjs/testing';
import { <Name>Service } from './<name>.service';

// Repository mocks
import { <Name>Repository } from './<name>.repository';

// External service mocks
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Factories — always from test/factories/
import {
  create<Name>Entity,
  create<Name>Dto,
} from '@test/factories/<name>.factory';

// Exceptions to assert
import {
  ResourceNotFoundException,
  // Add domain-specific exceptions
} from '@common/exceptions';

// Event names to assert
import { EventNames } from '@common/events/event-names';

// ── Mock Objects — ALWAYS at module scope, NEVER inside describe ────────
const mock<Name>Repository = {
  findById: jest.fn(),
  findByIdOrFail: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  createQueryRunner: jest.fn(),
  // Add all methods the service calls
};

const mockConfigService = {
  get: jest.fn().mockImplementation(
    (key: string, defaultVal?: unknown) => {
      const config: Record<string, unknown> = {
        'domain.minBidIncrement': 0,
        'domain.auctionDurationHours': 24,
        'domain.paymentWindowHours': 18,
      };
      return config[key] ?? defaultVal;
    },
  ),
};

const mockClsService = {
  get: jest.fn().mockImplementation((key: string) => {
    const store: Record<string, unknown> = {
      requestId: 'test-request-id',
      userId:    'test-user-id',
      userRoles: ['BIDDER'],
      userPermissions: ['bid:create', 'bid:view'],
    };
    return store[key] ?? null;
  }),
  set: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

// ── Test Suite ─────────────────────────────────────────────────────────
describe('<Name>Service', () => {
  let service: <Name>Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <Name>Service,
        { provide: <Name>Repository, useValue: mock<Name>Repository },
        { provide: ConfigService,     useValue: mockConfigService },
        { provide: ClsService,        useValue: mockClsService },
        { provide: EventEmitter2,     useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<<Name>Service>(<Name>Service);
  });

  // ── MANDATORY — always present ─────────────────────────────────────
  afterEach(() => jest.clearAllMocks());

  // ── Test groups per method ─────────────────────────────────────────
  describe('<methodName>', () => {
    // Test cases here
  });
});
```

---

## Step 3 — Test Case Templates Per Scenario

### Happy Path
```typescript
it('should <expected result> when <valid condition>', async () => {
  // Arrange — set up mocks with factory data
  const entity = create<Name>Entity({
    // Override specific fields needed for this scenario
    status: <Name>Status.ACTIVE,
  });
  const dto = create<Name>Dto({ amount: 200 });

  mock<Name>Repository.findById.mockResolvedValue(entity);
  mock<Name>Repository.create.mockResolvedValue(entity);

  // Act
  const result = await service.<methodName>(dto, 'user-id');

  // Assert — specific, not over-specified
  expect(result).toMatchObject({
    id: entity.id,
    // Assert fields that matter — not every field
  });
});
```

### Not Found
```typescript
it('should throw ResourceNotFoundException when <resource> does not exist',
  async () => {
    mock<Name>Repository.findById.mockResolvedValue(null);

    await expect(service.findById('non-existent-id'))
      .rejects.toThrow(ResourceNotFoundException);

    // Verify no further calls were made after exception
    expect(mock<Name>Repository.update).not.toHaveBeenCalled();
  },
);
```

### Business Rule Violation
```typescript
it('should throw <DomainException> when <rule violated>', async () => {
  const entity = create<Name>Entity({
    status: <Name>Status.CLOSED,    // Wrong state
  });
  mock<Name>Repository.findById.mockResolvedValue(entity);

  await expect(
    service.<methodName>('entity-id', 'user-id'),
  ).rejects.toThrow(<Domain>Exception);
});
```

### Ownership Violation
```typescript
it('should throw OwnershipException when user does not own resource',
  async () => {
    const entity = create<Name>Entity({
      owner: { id: 'different-owner-id' } as any,
    });
    mock<Name>Repository.findById.mockResolvedValue(entity);

    // mockClsService returns 'test-user-id' by default
    await expect(
      service.<methodName>('entity-id'),
    ).rejects.toThrow(<Name>OwnershipException);
  },
);
```

### Event Emission
```typescript
it('should emit <event> event after successful <operation>', async () => {
  const entity = create<Name>Entity();
  mock<Name>Repository.findById.mockResolvedValue(entity);
  mock<Name>Repository.update.mockResolvedValue(entity);

  await service.<methodName>('entity-id', 'user-id');

  expect(mockEventEmitter.emit).toHaveBeenCalledWith(
    EventNames.<EVENT_NAME>,
    expect.objectContaining({
      <name>Id: entity.id,
      // Assert key payload fields — not every field
    }),
  );
  // Verify emitted exactly once
  expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
});
```

### Event NOT Emitted on Failure
```typescript
it('should NOT emit event when operation fails', async () => {
  mock<Name>Repository.findById.mockResolvedValue(null);

  await expect(service.<methodName>('id', 'user-id'))
    .rejects.toThrow(ResourceNotFoundException);

  expect(mockEventEmitter.emit).not.toHaveBeenCalled();
});
```

### Transaction Rollback
```typescript
it('should rollback transaction and rethrow on DB failure', async () => {
  const entity = create<Name>Entity();
  const rollbackFn = jest.fn();
  const releaseFn = jest.fn();
  const commitFn = jest.fn();

  mock<Name>Repository.findById.mockResolvedValue(entity);
  mock<Name>Repository.createQueryRunner.mockReturnValue({
    connect:             jest.fn(),
    startTransaction:    jest.fn(),
    commitTransaction:   commitFn,
    rollbackTransaction: rollbackFn,
    release:             releaseFn,
    manager: {
      save: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      }),
    },
  });

  await expect(
    service.<methodName>(create<Name>Dto(), 'user-id'),
  ).rejects.toThrow('DB connection lost');

  expect(rollbackFn).toHaveBeenCalled();
  expect(releaseFn).toHaveBeenCalled();
  expect(commitFn).not.toHaveBeenCalled();
});
```

### Paginated Result
```typescript
it('should return paginated result with correct meta', async () => {
  const entities = [
    create<Name>Entity(),
    create<Name>Entity(),
    create<Name>Entity(),
  ];
  mock<Name>Repository.findAllPaginated
    .mockResolvedValue([entities, 3]);

  const query = { page: 1, limit: 20, order: 'desc', sortBy: 'createdAt' };
  const result = await service.findAll(query);

  expect(result.__paginated).toBe(true);
  expect(result.items).toHaveLength(3);
  expect(result.meta).toMatchObject({
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
  });
});
```

### Config Value Usage
```typescript
it('should use minBidIncrement from config', async () => {
  // Override config mock for this specific test
  mockConfigService.get.mockImplementation(
    (key: string, defaultVal?: unknown) => {
      if (key === 'domain.minBidIncrement') return 10;
      return defaultVal;
    },
  );

  const auction = createAuctionEntity({
    currentHighestBid: '100.00',
    status: AuctionStatus.ACTIVE,
    owner: { id: 'other-user' } as any,
  });
  const dto = createBidDto({ amount: 105 }); // Below 100 + 10 increment

  mockAuctionsRepository.findById.mockResolvedValue(auction);
  mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);

  await expect(service.placeBid(dto, 'user-id'))
    .rejects.toThrow(BidIncrementViolationException);
});
```

### Time-Dependent Logic
```typescript
it('should reject bid when auction has expired', async () => {
  // Use fake timers for time-dependent tests
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-23T12:00:00Z'));

  const auction = createAuctionEntity({
    status: AuctionStatus.ACTIVE,
    closesAt: new Date('2026-04-23T10:00:00Z'), // Already expired
    owner: { id: 'other-user' } as any,
  });
  mockAuctionsRepository.findById.mockResolvedValue(auction);

  await expect(service.placeBid(createBidDto(), 'user-id'))
    .rejects.toThrow(AuctionClosedException);

  jest.useRealTimers();
});
```

---

## Step 4 — Complete Test Suite Example — BidsService

```typescript
// src/modules/bids/bids.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BidsService } from './bids.service';
import { BidsRepository } from './bids.repository';
import { AuctionsRepository } from '@modules/auctions/auctions.repository';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createBidDto, createBidEntity } from '@test/factories/bid.factory';
import { createAuctionEntity } from '@test/factories/auction.factory';
import { AuctionStatus } from '@common/enums/auction-status.enum';
import { BidStatus } from '@common/enums/bid-status.enum';
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

// ── Mocks ───────────────────────────────────────────────────────────────
const mockBidsRepository = {
  findById: jest.fn(),
  findCurrentHighestBid: jest.fn(),
  findBidderHasLeadingBid: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  createQueryRunner: jest.fn(),
};

const mockAuctionsRepository = {
  findById: jest.fn(),
  update: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation(
    (key: string, defaultVal?: unknown) => {
      const config: Record<string, unknown> = {
        'domain.minBidIncrement': 0,
        'domain.auctionDurationHours': 24,
        'domain.paymentWindowHours': 18,
      };
      return config[key] ?? defaultVal;
    },
  ),
};

const mockClsService = {
  get: jest.fn().mockImplementation((key: string) => ({
    requestId: 'test-request-id',
    userId:    'test-user-id',
    userRoles: ['BIDDER'],
  }[key] ?? null)),
  set: jest.fn(),
};

const mockEventEmitter = { emit: jest.fn() };

// ── Suite ────────────────────────────────────────────────────────────────
describe('BidsService', () => {
  let service: BidsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidsService,
        { provide: BidsRepository,     useValue: mockBidsRepository },
        { provide: AuctionsRepository, useValue: mockAuctionsRepository },
        { provide: ConfigService,      useValue: mockConfigService },
        { provide: ClsService,         useValue: mockClsService },
        { provide: EventEmitter2,      useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<BidsService>(BidsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ────────────────────────────────────────────────────────────────────
  describe('placeBid', () => {

    // ── Happy path ─────────────────────────────────────────────────
    it('should place a valid bid and return bid entity', async () => {
      const dto = createBidDto({ amount: 200 });
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        startingPrice: '100.00',
        currentHighestBid: '150.00',
        owner: { id: 'other-owner' } as any,
      });
      const bid = createBidEntity({
        amount: '200.00',
        status: BidStatus.ACCEPTED,
      });

      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);
      mockBidsRepository.createQueryRunner.mockReturnValue({
        connect:             jest.fn(),
        startTransaction:    jest.fn(),
        commitTransaction:   jest.fn(),
        rollbackTransaction: jest.fn(),
        release:             jest.fn(),
        manager: {
          getRepository: jest.fn().mockReturnValue({
            create: jest.fn().mockReturnValue(bid),
            save:   jest.fn().mockResolvedValue(bid),
          }),
        },
      });
      mockAuctionsRepository.update.mockResolvedValue(auction);

      const result = await service.placeBid(dto, 'test-user-id');

      expect(result).toEqual(bid);
    });

    // ── Auction not found ──────────────────────────────────────────
    it('should throw AuctionNotFoundException when auction does not exist',
      async () => {
        mockAuctionsRepository.findById.mockResolvedValue(null);

        await expect(
          service.placeBid(createBidDto(), 'user-id'),
        ).rejects.toThrow(AuctionNotFoundException);

        expect(mockBidsRepository.create).not.toHaveBeenCalled();
      },
    );

    // ── Invalid auction state ──────────────────────────────────────
    it('should throw AuctionNotActiveException when auction is CLOSED',
      async () => {
        const auction = createAuctionEntity({
          status: AuctionStatus.CLOSED,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);

        await expect(
          service.placeBid(createBidDto(), 'user-id'),
        ).rejects.toThrow(AuctionNotActiveException);
      },
    );

    it('should throw AuctionNotActiveException when auction is SETTLED',
      async () => {
        const auction = createAuctionEntity({
          status: AuctionStatus.SETTLED,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);

        await expect(
          service.placeBid(createBidDto(), 'user-id'),
        ).rejects.toThrow(AuctionNotActiveException);
      },
    );

    // ── Expired auction ────────────────────────────────────────────
    it('should throw AuctionClosedException when closesAt has passed',
      async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-23T12:00:00Z'));

        const auction = createAuctionEntity({
          status: AuctionStatus.ACTIVE,
          closesAt: new Date('2026-04-23T10:00:00Z'),
          owner: { id: 'other-owner' } as any,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);

        await expect(
          service.placeBid(createBidDto(), 'user-id'),
        ).rejects.toThrow(AuctionClosedException);

        jest.useRealTimers();
      },
    );

    // ── Self bidding ───────────────────────────────────────────────
    it('should throw SelfBiddingException when bidder is auction owner',
      async () => {
        const ownerId = 'auction-owner-id';
        const auction = createAuctionEntity({
          status: AuctionStatus.ACTIVE,
          owner: { id: ownerId } as any,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);

        await expect(
          service.placeBid(createBidDto(), ownerId),
        ).rejects.toThrow(SelfBiddingException);
      },
    );

    // ── Duplicate leading bid ──────────────────────────────────────
    it('should throw DuplicateLeadingBidException when bidder already leads',
      async () => {
        const auction = createAuctionEntity({
          status: AuctionStatus.ACTIVE,
          owner: { id: 'other-owner' } as any,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);
        mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(true);

        await expect(
          service.placeBid(createBidDto({ amount: 500 }), 'user-id'),
        ).rejects.toThrow(DuplicateLeadingBidException);
      },
    );

    // ── Bid below minimum ──────────────────────────────────────────
    it('should throw BidBelowMinimumException when amount equals current highest',
      async () => {
        const auction = createAuctionEntity({
          status: AuctionStatus.ACTIVE,
          currentHighestBid: '150.00',
          owner: { id: 'other-owner' } as any,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);
        mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);

        await expect(
          service.placeBid(createBidDto({ amount: 150 }), 'user-id'),
        ).rejects.toThrow(BidBelowMinimumException);
      },
    );

    it('should throw BidBelowMinimumException when amount is below current highest',
      async () => {
        const auction = createAuctionEntity({
          status: AuctionStatus.ACTIVE,
          currentHighestBid: '150.00',
          owner: { id: 'other-owner' } as any,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);
        mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);

        await expect(
          service.placeBid(createBidDto({ amount: 100 }), 'user-id'),
        ).rejects.toThrow(BidBelowMinimumException);
      },
    );

    // ── Bid increment violation ────────────────────────────────────
    it('should throw BidIncrementViolationException when increment not met',
      async () => {
        mockConfigService.get.mockImplementation(
          (key: string, def?: unknown) =>
            key === 'domain.minBidIncrement' ? 10 : def,
        );

        const auction = createAuctionEntity({
          status: AuctionStatus.ACTIVE,
          currentHighestBid: '100.00',
          owner: { id: 'other-owner' } as any,
        });
        mockAuctionsRepository.findById.mockResolvedValue(auction);
        mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);

        // 105 is above 100 but below 100 + 10 increment
        await expect(
          service.placeBid(createBidDto({ amount: 105 }), 'user-id'),
        ).rejects.toThrow(BidIncrementViolationException);
      },
    );

    // ── Event emission ─────────────────────────────────────────────
    it('should emit bid.accepted event on successful bid', async () => {
      const dto = createBidDto({ amount: 200 });
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        currentHighestBid: '150.00',
        owner: { id: 'other-owner' } as any,
      });
      const bid = createBidEntity({ amount: '200.00' });

      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);
      mockBidsRepository.createQueryRunner.mockReturnValue({
        connect:             jest.fn(),
        startTransaction:    jest.fn(),
        commitTransaction:   jest.fn(),
        rollbackTransaction: jest.fn(),
        release:             jest.fn(),
        manager: {
          getRepository: jest.fn().mockReturnValue({
            create: jest.fn().mockReturnValue(bid),
            save:   jest.fn().mockResolvedValue(bid),
          }),
        },
      });
      mockAuctionsRepository.update.mockResolvedValue(auction);

      await service.placeBid(dto, 'user-id');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.BID_ACCEPTED,
        expect.objectContaining({
          bidId:     bid.id,
          auctionId: dto.auctionId,
          amount:    dto.amount,
        }),
      );
    });

    it('should emit auction.activated event when first bid placed', async () => {
      const dto = createBidDto({ amount: 200 });
      const auction = createAuctionEntity({
        status: AuctionStatus.PENDING,   // First bid — PENDING state
        startingPrice: '100.00',
        currentHighestBid: null,
        owner: { id: 'other-owner' } as any,
      });
      const bid = createBidEntity({ amount: '200.00' });

      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);
      mockBidsRepository.createQueryRunner.mockReturnValue({
        connect:             jest.fn(),
        startTransaction:    jest.fn(),
        commitTransaction:   jest.fn(),
        rollbackTransaction: jest.fn(),
        release:             jest.fn(),
        manager: {
          getRepository: jest.fn().mockReturnValue({
            create: jest.fn().mockReturnValue(bid),
            save:   jest.fn().mockResolvedValue(bid),
          }),
        },
      });
      mockAuctionsRepository.update.mockResolvedValue({
        ...auction,
        status: AuctionStatus.ACTIVE,
      });

      await service.placeBid(dto, 'user-id');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.AUCTION_ACTIVATED,
        expect.objectContaining({
          auctionId: dto.auctionId,
        }),
      );
    });

    // ── Transaction rollback ───────────────────────────────────────
    it('should rollback transaction and rethrow on DB failure', async () => {
      const dto = createBidDto({ amount: 200 });
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        currentHighestBid: '150.00',
        owner: { id: 'other-owner' } as any,
      });
      const rollbackFn = jest.fn();
      const releaseFn = jest.fn();

      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);
      mockBidsRepository.createQueryRunner.mockReturnValue({
        connect:             jest.fn(),
        startTransaction:    jest.fn(),
        commitTransaction:   jest.fn(),
        rollbackTransaction: rollbackFn,
        release:             releaseFn,
        manager: {
          getRepository: jest.fn().mockReturnValue({
            create: jest.fn().mockReturnValue({}),
            save:   jest.fn().mockRejectedValue(
              new Error('DB connection lost'),
            ),
          }),
        },
      });

      await expect(
        service.placeBid(dto, 'user-id'),
      ).rejects.toThrow('DB connection lost');

      expect(rollbackFn).toHaveBeenCalled();
      expect(releaseFn).toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
```

---

## Step 5 — Coverage Requirements

These service methods require 100% branch coverage:

```typescript
// BidsService.placeBid — every validation branch must be tested:
// ✅ auction not found
// ✅ auction not ACTIVE or PENDING
// ✅ auction closesAt expired
// ✅ self bidding
// ✅ duplicate leading bid
// ✅ bid below minimum (equal)
// ✅ bid below minimum (lower)
// ✅ bid increment violation
// ✅ happy path — successful bid
// ✅ happy path — first bid (PENDING → ACTIVE)
// ✅ event emitted on success
// ✅ events NOT emitted on failure
// ✅ transaction rollback on DB failure

// AuctionsService state transitions — every state must be tested
// JwtAuthGuard — public route bypass + valid token + invalid token
// PermissionsGuard — no permissions + sufficient + insufficient
```

---

## Step 6 — Forbidden Patterns Reminder

```typescript
// ❌ NEVER do these — they cause inconsistent AI-generated tests

// Mocks inside describe blocks
describe('Service', () => {
  const mockRepo = { findById: jest.fn() }; // Wrong — module scope only
});

// jest.spyOn on private methods
jest.spyOn(service as any, 'privateMethod'); // Never

// Hardcoded test data
const entity = { id: '123', amount: '100' }; // Use factories

// Missing afterEach
// Every file must have afterEach(() => jest.clearAllMocks())

// Over-specifying assertions
expect(mock.create).toHaveBeenCalledTimes(1);   // Fragile
expect(mock.create).toHaveBeenCalledWith(
  expect.objectContaining({ amount: '200.00' }), // Better — key fields only
);

// Real DB in unit tests
mockRepo.findById.mockImplementation(
  async (id) => realRepo.findById(id),           // Never
);
```

---

## Step 7 — Final Checklist

  ✅ All mock objects at module scope — never inside describe
  ✅ afterEach(() => jest.clearAllMocks()) present
  ✅ Factories used for all test data — no hardcoded values
  ✅ All public methods have test coverage
  ✅ All exception cases tested with correct exception class
  ✅ Happy path tested with realistic data
  ✅ Event emission asserted on successful operations
  ✅ Event NOT emitted asserted on failed operations
  ✅ Transaction rollback tested where applicable
  ✅ Time-dependent tests use jest.useFakeTimers()
  ✅ jest.useRealTimers() called after time tests
  ✅ Config-dependent tests override mockConfigService.get
  ✅ No jest.spyOn on private methods
  ✅ Test names follow: should <result> when <condition>
  ✅ npm run test — all tests pass
  ✅ Coverage thresholds met for tested class