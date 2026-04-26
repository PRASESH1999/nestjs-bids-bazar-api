---
name: write-integration-test
description: >
  Use this skill when the user asks to write integration tests for a
  repository or any class that directly interacts with the database.
  Triggers include: "write integration tests for X repository", "test
  the bids repository", "add DB tests for Y", "integration test for
  the auctions repository", "test the actual DB queries", "write repo
  tests with real database". Always read this skill before writing any
  *.integration.spec.ts file.
---

# Skill: write-integration-test

## References — Read Before Starting

- [SKILL.md] — project context, open decisions
- [references/testing-standards.md] — integration test setup,
  DB helpers, transaction isolation pattern
- [references/typeorm-patterns.md] — query patterns being tested
- [references/conventions.md] — test naming conventions
- [references/environment.md] — test DB config (.env.test)

---

## Step 0 — Extract Test Details

Before writing any test confirm:

| Detail | Extract From Request |
|---|---|
| Repository under test | Which repository class? |
| Methods to test | All public methods or specific ones? |
| Entity dependencies | Which related entities are needed? |
| Existing test file | Does integration spec already exist? |

Never write integration tests for services — only repositories.
Services get unit tests. Repositories get integration tests.
This is the rule from references/testing-standards.md.

---

## Step 1 — Read the Repository Source First

Before writing any test read:
- The repository class being tested
- All public methods and their query logic
- All relations loaded
- All filters applied

Never write tests from memory — always read the implementation.

---

## Step 2 — Test DB Requirements

Integration tests run against a REAL PostgreSQL test database.

```bash
# Required env vars in .env.test
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bids_bazar_api_test    # Separate test DB — never dev or prod
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
```

The test DB must:
- Exist before tests run
- Have all migrations applied
- Be reset between test suites (not between individual tests)
- Use transactions per test for isolation and speed

---

## Step 3 — Standard Integration Test Structure

```typescript
// src/modules/<name>/<name>.repository.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { <Name>Repository } from './<name>.repository';
import { <Name>Entity } from './entities/<name>.entity';

// Import all entities needed for relations
import { UserEntity } from '@modules/users/entities/user.entity';
import { AuctionEntity } from '@modules/auctions/entities/auction.entity';

// Import enums for test data
import { <Name>Status } from '@common/enums/<name>-status.enum';

// Import DB helper utilities
import {
  resetTestDatabase,
  seedIntegrationData,
} from '@test/helpers/db.helper';

// ── Test Module Setup ──────────────────────────────────────────────────
describe('<Name>Repository (integration)', () => {
  let repository: <Name>Repository;
  let dataSource: DataSource;

  // Seed data IDs — set in beforeAll, used in tests
  let testUserId: string;
  let testAuctionId: string;

  // Transaction per test — rolled back after each test
  let queryRunner: QueryRunner;

  // ── Global Setup — runs once before all tests in suite ──────────────
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: parseInt(process.env.DB_PORT ?? '5432'),
          database: process.env.DB_NAME ?? 'bids_bazar_api_test',
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          ssl: false,
          // Register all entities the repository needs
          entities: [<Name>Entity, UserEntity, AuctionEntity],
          synchronize: false,      // Never true — migrations only
          logging: false,          // Suppress query logs in tests
        }),
        TypeOrmModule.forFeature([<Name>Entity]),
      ],
      providers: [<Name>Repository],
    }).compile();

    repository = module.get<<Name>Repository>(<Name>Repository);
    dataSource = module.get<DataSource>(DataSource);

    // Reset DB and run migrations once before all tests
    await resetTestDatabase(dataSource);

    // Seed minimal base data needed by all tests
    const seedData = await seedIntegrationData(dataSource);
    testUserId = seedData.userId;
    testAuctionId = seedData.auctionId;
  });

  // ── Global Teardown ─────────────────────────────────────────────────
  afterAll(async () => {
    await dataSource.destroy();
  });

  // ── Per-Test Transaction — provides isolation without full DB reset ──
  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    // Always rollback — keeps tests isolated and fast
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  // ── Test Groups Per Method ───────────────────────────────────────────
  describe('<methodName>', () => {
    // Test cases here
  });
});
```

---

## Step 4 — Test Case Templates

### findById
```typescript
describe('findById', () => {
  it('should return entity when it exists', async () => {
    // Arrange — create entity directly via queryRunner
    const created = await queryRunner.manager.save(<Name>Entity,
      queryRunner.manager.create(<Name>Entity, {
        // Required fields for this entity
        status: <Name>Status.ACTIVE,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
        amount: '100.00',
      }),
    );

    // Act
    const result = await repository.findById(created.id);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.id).toBe(created.id);
  });

  it('should return null when entity does not exist', async () => {
    const result = await repository.findById(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(result).toBeNull();
  });

  it('should not return soft-deleted entities', async () => {
    // Create and soft-delete
    const created = await queryRunner.manager.save(<Name>Entity,
      queryRunner.manager.create(<Name>Entity, {
        status: <Name>Status.ACTIVE,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
        amount: '100.00',
      }),
    );
    await queryRunner.manager.softDelete(<Name>Entity, created.id);

    // Should not find soft-deleted record
    const result = await repository.findById(created.id);
    expect(result).toBeNull();
  });
});
```

### findAll / findAllPaginated
```typescript
describe('findAllPaginated', () => {
  it('should return paginated results', async () => {
    // Create multiple entities
    await queryRunner.manager.save(<Name>Entity, [
      queryRunner.manager.create(<Name>Entity, {
        amount: '100.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(<Name>Entity, {
        amount: '200.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(<Name>Entity, {
        amount: '300.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    ]);

    // Act — page 1, limit 2
    const [items, total] = await repository.findAllPaginated({
      page: 1,
      limit: 2,
      order: 'desc',
      sortBy: 'createdAt',
    });

    // Assert
    expect(items).toHaveLength(2);
    expect(total).toBe(3);
  });

  it('should filter by status', async () => {
    await queryRunner.manager.save(<Name>Entity, [
      queryRunner.manager.create(<Name>Entity, {
        amount: '100.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(<Name>Entity, {
        amount: '200.00',
        status: <Name>Status.REJECTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    ]);

    const [items, total] = await repository.findAllPaginated({
      page: 1,
      limit: 20,
      order: 'desc',
      sortBy: 'createdAt',
      status: <Name>Status.ACCEPTED,
    });

    expect(total).toBe(1);
    expect(items[0].status).toBe(<Name>Status.ACCEPTED);
  });

  it('should return empty array when no records exist', async () => {
    const [items, total] = await repository.findAllPaginated({
      page: 1,
      limit: 20,
      order: 'desc',
      sortBy: 'createdAt',
    });

    expect(items).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('should sort by amount descending', async () => {
    await queryRunner.manager.save(<Name>Entity, [
      queryRunner.manager.create(<Name>Entity, {
        amount: '100.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(<Name>Entity, {
        amount: '300.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(<Name>Entity, {
        amount: '200.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    ]);

    const [items] = await repository.findAllPaginated({
      page: 1,
      limit: 20,
      order: 'desc',
      sortBy: 'amount',
    });

    expect(parseFloat(items[0].amount)).toBe(300);
    expect(parseFloat(items[1].amount)).toBe(200);
    expect(parseFloat(items[2].amount)).toBe(100);
  });
});
```

### create
```typescript
describe('create', () => {
  it('should create and persist entity', async () => {
    const result = await repository.create(
      {
        amount: '500.00',
        status: <Name>Status.SUBMITTED,
        auction: { id: testAuctionId } as AuctionEntity,
        bidder: { id: testUserId } as UserEntity,
      },
      queryRunner,
    );

    // Verify persisted
    expect(result.id).toBeDefined();
    expect(result.amount).toBe('500.00');
    expect(result.createdAt).toBeDefined();

    // Verify in DB
    const found = await queryRunner.manager.findOne(
      <Name>Entity,
      { where: { id: result.id } },
    );
    expect(found).not.toBeNull();
    expect(found!.amount).toBe('500.00');
  });

  it('should auto-generate UUID for id', async () => {
    const result = await repository.create(
      {
        amount: '100.00',
        status: <Name>Status.SUBMITTED,
        auction: { id: testAuctionId } as AuctionEntity,
        bidder: { id: testUserId } as UserEntity,
      },
      queryRunner,
    );

    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should set createdAt and updatedAt automatically', async () => {
    const before = new Date();

    const result = await repository.create(
      {
        amount: '100.00',
        status: <Name>Status.SUBMITTED,
        auction: { id: testAuctionId } as AuctionEntity,
        bidder: { id: testUserId } as UserEntity,
      },
      queryRunner,
    );

    const after = new Date();

    expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(result.createdAt.getTime()).toBeLessThanOrEqual(
      after.getTime(),
    );
    expect(result.updatedAt).toBeDefined();
  });
});
```

### update
```typescript
describe('update', () => {
  it('should update specified fields only', async () => {
    const created = await queryRunner.manager.save(
      <Name>Entity,
      queryRunner.manager.create(<Name>Entity, {
        amount: '100.00',
        status: <Name>Status.SUBMITTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    );

    await repository.update(
      created.id,
      { status: <Name>Status.ACCEPTED },
      queryRunner,
    );

    const updated = await queryRunner.manager.findOne(
      <Name>Entity,
      { where: { id: created.id } },
    );

    expect(updated!.status).toBe(<Name>Status.ACCEPTED);
    expect(updated!.amount).toBe('100.00');  // Unchanged
  });

  it('should update updatedAt timestamp on update', async () => {
    const created = await queryRunner.manager.save(
      <Name>Entity,
      queryRunner.manager.create(<Name>Entity, {
        amount: '100.00',
        status: <Name>Status.SUBMITTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    );

    const originalUpdatedAt = created.updatedAt;

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 10));

    await repository.update(
      created.id,
      { status: <Name>Status.ACCEPTED },
      queryRunner,
    );

    const updated = await queryRunner.manager.findOne(
      <Name>Entity,
      { where: { id: created.id } },
    );

    expect(updated!.updatedAt.getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime(),
    );
  });
});
```

### softDelete
```typescript
describe('softDelete', () => {
  it('should set deletedAt and exclude from normal queries', async () => {
    const created = await queryRunner.manager.save(
      <Name>Entity,
      queryRunner.manager.create(<Name>Entity, {
        amount: '100.00',
        status: <Name>Status.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    );

    await repository.softDelete(created.id);

    // Normal find should not return soft-deleted
    const notFound = await repository.findById(created.id);
    expect(notFound).toBeNull();

    // But withDeleted should find it
    const found = await queryRunner.manager.findOne(
      <Name>Entity,
      {
        where: { id: created.id },
        withDeleted: true,
      },
    );
    expect(found).not.toBeNull();
    expect(found!.deletedAt).not.toBeNull();
  });
});
```

### Domain-Specific Query Tests
```typescript
// For BidsRepository.findCurrentHighestBid
describe('findCurrentHighestBid', () => {
  it('should return highest ACCEPTED bid for auction', async () => {
    await queryRunner.manager.save(BidEntity, [
      queryRunner.manager.create(BidEntity, {
        amount: '100.00',
        status: BidStatus.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(BidEntity, {
        amount: '250.00',
        status: BidStatus.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(BidEntity, {
        amount: '200.00',
        status: BidStatus.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    ]);

    const result = await repository.findCurrentHighestBid(testAuctionId);

    expect(result).not.toBeNull();
    expect(parseFloat(result!.amount)).toBe(250);
  });

  it('should not count REJECTED bids as highest', async () => {
    await queryRunner.manager.save(BidEntity, [
      queryRunner.manager.create(BidEntity, {
        amount: '500.00',
        status: BidStatus.REJECTED,    // Should be ignored
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
      queryRunner.manager.create(BidEntity, {
        amount: '100.00',
        status: BidStatus.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      }),
    ]);

    const result = await repository.findCurrentHighestBid(testAuctionId);

    expect(parseFloat(result!.amount)).toBe(100);  // Not 500
  });

  it('should return null when no ACCEPTED bids exist', async () => {
    const result = await repository.findCurrentHighestBid(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(result).toBeNull();
  });

  it('should use earliest timestamp as tiebreaker for equal amounts',
    async () => {
      const earlier = new Date('2026-04-23T10:00:00Z');
      const later   = new Date('2026-04-23T11:00:00Z');

      await queryRunner.manager.save(BidEntity, [
        queryRunner.manager.create(BidEntity, {
          amount: '200.00',
          status: BidStatus.ACCEPTED,
          submittedAt: later,
          auction: { id: testAuctionId },
          bidder: { id: testUserId },
        }),
        queryRunner.manager.create(BidEntity, {
          amount: '200.00',
          status: BidStatus.ACCEPTED,
          submittedAt: earlier,        // Same amount — earlier wins
          auction: { id: testAuctionId },
          bidder: { id: testUserId },
        }),
      ]);

      const result = await repository.findCurrentHighestBid(testAuctionId);

      // Earlier timestamp wins the tiebreak
      expect(result!.submittedAt!.getTime()).toBe(earlier.getTime());
    },
  );
});
```

---

## Step 5 — DB Helper Implementation

```typescript
// test/helpers/db.helper.ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '@modules/users/entities/user.entity';
import { AuctionEntity } from '@modules/auctions/entities/auction.entity';
import { Role } from '@common/enums/role.enum';
import { AuctionStatus } from '@common/enums/auction-status.enum';

export interface IntegrationSeedData {
  userId: string;
  auctionId: string;
  ownerId: string;
}

export async function resetTestDatabase(
  dataSource: DataSource,
): Promise<void> {
  // Drop all tables respecting FK constraints
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');

  // Re-run all migrations
  await dataSource.runMigrations({ transaction: 'all' });

  console.log('Test database reset and migrations applied.');
}

export async function seedIntegrationData(
  dataSource: DataSource,
): Promise<IntegrationSeedData> {
  const usersRepo = dataSource.getRepository(UserEntity);
  const auctionsRepo = dataSource.getRepository(AuctionEntity);

  const hashedPassword = await bcrypt.hash('TestPass123!', 12);

  // Create bidder user
  const bidder = await usersRepo.save(
    usersRepo.create({
      email: 'integration-bidder@test.com',
      password: hashedPassword,
      firstName: 'Integration',
      lastName: 'Bidder',
      roles: [Role.BIDDER],
      isLocked: false,
      failedLoginAttempts: 0,
    }),
  );

  // Create auctioneer (auction owner)
  const owner = await usersRepo.save(
    usersRepo.create({
      email: 'integration-owner@test.com',
      password: hashedPassword,
      firstName: 'Integration',
      lastName: 'Owner',
      roles: [Role.AUCTIONEER],
      isLocked: false,
      failedLoginAttempts: 0,
    }),
  );

  // Create active auction
  const auction = await auctionsRepo.save(
    auctionsRepo.create({
      title: 'Integration Test Auction',
      startingPrice: '100.00',
      status: AuctionStatus.ACTIVE,
      durationHours: 24,
      firstBidAt: new Date(),
      closesAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      owner,
    }),
  );

  return {
    userId: bidder.id,
    ownerId: owner.id,
    auctionId: auction.id,
  };
}
```

---

## Step 6 — Jest Config for Integration Tests

```typescript
// Already in jest.config.ts — reference only
{
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.integration.spec.ts'],
  testTimeout: 30000,
  globalSetup: '<rootDir>/test/helpers/global-setup.ts',
  globalTeardown: '<rootDir>/test/helpers/global-teardown.ts',
}
```

```typescript
// test/helpers/global-setup.ts
// Runs once before all integration test suites
export default async function globalSetup(): Promise<void> {
  // Verify test DB connection before running any tests
  const { Client } = await import('pg');
  const client = new Client({
    host:     process.env.DB_HOST ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_NAME ?? 'bids_bazar_api_test',
    user:     process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log('Test database connection verified.');
  } catch (error) {
    throw new Error(
      `Cannot connect to test database. ` +
      `Ensure bids_bazar_api_test DB exists and .env.test is configured. ` +
      `Error: ${(error as Error).message}`,
    );
  } finally {
    await client.end();
  }
}

// test/helpers/global-teardown.ts
export default async function globalTeardown(): Promise<void> {
  console.log('Integration test suite completed.');
}
```

---

## Step 7 — Integration Test Rules

```typescript
// ✅ Always use real PostgreSQL — never sqlite or in-memory
// ✅ Always use .env.test for test DB config
// ✅ Always reset DB in beforeAll — not beforeEach (too slow)
// ✅ Use queryRunner transactions per test for isolation
// ✅ Always rollback in afterEach — never commit test data
// ✅ Always call dataSource.destroy() in afterAll
// ✅ Create test data in queryRunner — not via repository methods
// ✅ Verify DB state directly via queryRunner after mutations
// ✅ Test soft delete exclusion explicitly
// ✅ Test sort order explicitly — never assume
// ✅ Test pagination boundaries (page 1, page 2, empty page)
// ✅ Test filter combinations — not just single filters
// ✅ Test tiebreaker logic for equal values

// ❌ Never mock the repository in integration tests
// ❌ Never use real external services (email, queues)
// ❌ Never test services in integration tests — only repositories
// ❌ Never commit test data — always rollback
// ❌ Never use synchronize:true — always migrations
// ❌ Never hardcode data — use queryRunner.manager.create()
// ❌ Never run against dev or prod DB
```

---

## Step 8 — Final Checklist

  ✅ File named: <name>.repository.integration.spec.ts
  ✅ Uses real PostgreSQL test database
  ✅ resetTestDatabase called in beforeAll
  ✅ seedIntegrationData called in beforeAll
  ✅ queryRunner created in beforeEach
  ✅ queryRunner.rollbackTransaction in afterEach
  ✅ queryRunner.release in afterEach
  ✅ dataSource.destroy in afterAll
  ✅ All public repository methods tested
  ✅ findById tests: found, not found, soft-deleted excluded
  ✅ findAll tests: empty, paginated, filtered, sorted
  ✅ create tests: persisted, UUID generated, timestamps set
  ✅ update tests: fields updated, untouched fields unchanged
  ✅ softDelete tests: excluded from queries, deletedAt set
  ✅ Domain queries tested: all branches covered
  ✅ Tiebreaker logic tested where applicable
  ✅ npm run test:integration — all tests pass