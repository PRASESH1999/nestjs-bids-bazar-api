# Testing Standards Reference

> Read this before writing ANY test — unit, integration, or e2e.
> Follow every pattern exactly — no improvised mocking, no inline
> jest.fn() scattered arbitrarily, no hardcoded test data.
> AI tools generating tests must follow this reference exactly.

---

## Core Philosophy

- Every module is independently testable from day one.
- Prefer real integrations over mocks wherever practical.
- Mocks are the last resort — not the default.
- A feature is not done until its tests pass.
- Tests are first-class citizens — same quality standard as production code.

---

## Jest Configuration

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  projects: [
    // ── Unit Tests ─────────────────────────────────────────────────────
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      // Exclude integration tests
      testPathIgnorePatterns: ['.*\\.integration\\.spec\\.ts'],
      moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@database/(.*)$': '<rootDir>/src/database/$1',
        '^@test/(.*)$': '<rootDir>/test/$1',
      },
      coverageThreshold: {
        global: {
          statements: 80,
          branches: 80,
          functions: 85,
          lines: 80,
        },
      },
    },

    // ── Integration Tests ──────────────────────────────────────────────
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.integration.spec.ts'],
      moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@database/(.*)$': '<rootDir>/src/database/$1',
        '^@test/(.*)$': '<rootDir>/test/$1',
      },
      testTimeout: 30000,     // Integration tests need more time
      globalSetup: '<rootDir>/test/helpers/global-setup.ts',
      globalTeardown: '<rootDir>/test/helpers/global-teardown.ts',
    },

    // ── E2E Tests ──────────────────────────────────────────────────────
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.e2e.spec.ts'],
      moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@database/(.*)$': '<rootDir>/src/database/$1',
        '^@test/(.*)$': '<rootDir>/test/$1',
      },
      testTimeout: 30000,
      globalSetup: '<rootDir>/test/helpers/global-setup.ts',
      globalTeardown: '<rootDir>/test/helpers/global-teardown.ts',
    },
  ],

  // ── Coverage ───────────────────────────────────────────────────────────
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
  ],

  // ── Global Settings ────────────────────────────────────────────────────
  randomize: true,            // Tests must never depend on execution order
  verbose: true,
};

export default config;
```

---

## Standard Mock Pattern — Follow Exactly

```typescript
// ✅ THE ONLY ACCEPTABLE MOCK PATTERN FOR REPOSITORIES
// Define mock object at module scope — never inside describe or it blocks

const mockBidsRepository = {
  findById: jest.fn(),
  findByIdOrFail: jest.fn(),
  findAllByAuction: jest.fn(),
  findCurrentHighestBid: jest.fn(),
  findFallbackChain: jest.fn(),
  findBidderHasLeadingBid: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  softDelete: jest.fn(),
  createQueryRunner: jest.fn(),
};

const mockAuctionsRepository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string, defaultVal?: unknown) => {
    const config: Record<string, unknown> = {
      'domain.minBidIncrement': 0,
      'domain.auctionDurationHours': 24,
      'domain.paymentWindowHours': 18,
    };
    return config[key] ?? defaultVal;
  }),
};

const mockClsService = {
  get: jest.fn().mockImplementation((key: string) => {
    const store: Record<string, unknown> = {
      requestId: 'test-request-id',
      userId: 'test-user-id',
      userRoles: ['BIDDER'],
      userPermissions: ['bid:create', 'bid:view'],
    };
    return store[key] ?? null;
  }),
  set: jest.fn(),
};
```

---

## Unit Test Structure — Standard Template

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
import {
  AuctionNotFoundException,
  AuctionNotActiveException,
  SelfBiddingException,
  DuplicateLeadingBidException,
  BidBelowMinimumException,
} from '@common/exceptions';
import { EventNames } from '@common/events/event-names';

// ── Mock Definitions — Module Scope ───────────────────────────────────────
// Always at top of file, never inside describe blocks
const mockBidsRepository = {
  findById: jest.fn(),
  findCurrentHighestBid: jest.fn(),
  findBidderHasLeadingBid: jest.fn(),
  create: jest.fn(),
  createQueryRunner: jest.fn(),
};

const mockAuctionsRepository = {
  findById: jest.fn(),
  update: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue(0),   // Default: no bid increment
};

const mockClsService = {
  get: jest.fn().mockImplementation((key: string) => ({
    requestId: 'test-request-id',
    userId: 'test-user-id',
  }[key] ?? null)),
};

const mockEventEmitter = {
  emit: jest.fn(),
};

// ── Test Suite ─────────────────────────────────────────────────────────────
describe('BidsService', () => {
  let service: BidsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidsService,
        { provide: BidsRepository, useValue: mockBidsRepository },
        { provide: AuctionsRepository, useValue: mockAuctionsRepository },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ClsService, useValue: mockClsService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<BidsService>(BidsService);
  });

  // ── Always clear mocks after each test ────────────────────────────────
  afterEach(() => jest.clearAllMocks());

  // ── placeBid ──────────────────────────────────────────────────────────
  describe('placeBid', () => {
    it('should place a valid bid and return the bid entity', async () => {
      // Arrange
      const dto = createBidDto({ amount: 200 });
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        startingPrice: '100',
        currentHighestBid: '150',
        owner: { id: 'other-user-id' } as any,
      });
      const bid = createBidEntity({ amount: '200', status: BidStatus.ACCEPTED });

      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);
      mockBidsRepository.createQueryRunner.mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: { save: jest.fn().mockResolvedValue(bid) },
      });
      mockAuctionsRepository.update.mockResolvedValue(auction);

      // Act
      const result = await service.placeBid(dto, 'test-user-id');

      // Assert
      expect(result).toEqual(bid);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.BID_ACCEPTED,
        expect.objectContaining({
          bidId: bid.id,
          auctionId: dto.auctionId,
        }),
      );
    });

    it('should throw AuctionNotFoundException when auction does not exist', async () => {
      const dto = createBidDto();
      mockAuctionsRepository.findById.mockResolvedValue(null);

      await expect(service.placeBid(dto, 'user-id'))
        .rejects.toThrow(AuctionNotFoundException);
    });

    it('should throw AuctionNotActiveException when auction is not active', async () => {
      const dto = createBidDto();
      const auction = createAuctionEntity({
        status: AuctionStatus.CLOSED,
      });
      mockAuctionsRepository.findById.mockResolvedValue(auction);

      await expect(service.placeBid(dto, 'user-id'))
        .rejects.toThrow(AuctionNotActiveException);
    });

    it('should throw SelfBiddingException when bidder is auction owner', async () => {
      const ownerId = 'owner-user-id';
      const dto = createBidDto();
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        owner: { id: ownerId } as any,
      });
      mockAuctionsRepository.findById.mockResolvedValue(auction);

      await expect(service.placeBid(dto, ownerId))
        .rejects.toThrow(SelfBiddingException);
    });

    it('should throw DuplicateLeadingBidException when bidder already leads', async () => {
      const userId = 'test-user-id';
      const dto = createBidDto();
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        owner: { id: 'other-owner' } as any,
      });
      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(true);

      await expect(service.placeBid(dto, userId))
        .rejects.toThrow(DuplicateLeadingBidException);
    });

    it('should throw BidBelowMinimumException when bid is not above current highest', async () => {
      const dto = createBidDto({ amount: 100 });
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        currentHighestBid: '150',
        owner: { id: 'other-user' } as any,
      });
      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);

      await expect(service.placeBid(dto, 'user-id'))
        .rejects.toThrow(BidBelowMinimumException);
    });

    it('should emit bid.accepted event on successful bid placement', async () => {
      const dto = createBidDto({ amount: 200 });
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        currentHighestBid: '150',
        owner: { id: 'other-user' } as any,
      });
      const bid = createBidEntity({ amount: '200' });

      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);
      mockBidsRepository.createQueryRunner.mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: { save: jest.fn().mockResolvedValue(bid) },
      });
      mockAuctionsRepository.update.mockResolvedValue(auction);

      await service.placeBid(dto, 'user-id');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EventNames.BID_ACCEPTED,
        expect.objectContaining({ bidId: bid.id }),
      );
    });

    it('should rollback transaction and rethrow on DB failure', async () => {
      const dto = createBidDto({ amount: 200 });
      const auction = createAuctionEntity({
        status: AuctionStatus.ACTIVE,
        currentHighestBid: '150',
        owner: { id: 'other-user' } as any,
      });
      const rollbackFn = jest.fn();
      const releaseFn = jest.fn();

      mockAuctionsRepository.findById.mockResolvedValue(auction);
      mockBidsRepository.findBidderHasLeadingBid.mockResolvedValue(false);
      mockBidsRepository.createQueryRunner.mockReturnValue({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: rollbackFn,
        release: releaseFn,
        manager: {
          save: jest.fn().mockRejectedValue(new Error('DB error')),
        },
      });

      await expect(service.placeBid(dto, 'user-id'))
        .rejects.toThrow('DB error');

      expect(rollbackFn).toHaveBeenCalled();
      expect(releaseFn).toHaveBeenCalled();
    });
  });
});
```

---

## Test Factories — Standard Implementation

```typescript
// test/factories/bid.factory.ts
import { faker } from '@faker-js/faker';
import { BidEntity } from '@modules/bids/entities/bid.entity';
import { BidStatus } from '@common/enums/bid-status.enum';
import { CreateBidDto } from '@modules/bids/dto/create-bid.dto';

export const createBidEntity = (
  overrides?: Partial<BidEntity>,
): BidEntity => ({
  id: faker.string.uuid(),
  amount: faker.number
    .float({ min: 10, max: 10000, fractionDigits: 2 })
    .toString(),
  status: BidStatus.ACCEPTED,
  submittedAt: new Date(),
  fallbackRank: null,
  auction: { id: faker.string.uuid() } as any,
  bidder: { id: faker.string.uuid() } as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createBidDto = (
  overrides?: Partial<CreateBidDto>,
): CreateBidDto => ({
  auctionId: faker.string.uuid(),
  amount: faker.number.float({ min: 10, max: 10000, fractionDigits: 2 }),
  ...overrides,
});

// test/factories/auction.factory.ts
import { faker } from '@faker-js/faker';
import { AuctionEntity } from '@modules/auctions/entities/auction.entity';
import { AuctionStatus } from '@common/enums/auction-status.enum';
import { CreateAuctionDto } from '@modules/auctions/dto/create-auction.dto';

export const createAuctionEntity = (
  overrides?: Partial<AuctionEntity>,
): AuctionEntity => ({
  id: faker.string.uuid(),
  title: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  startingPrice: '100.00',
  currentHighestBid: null,
  status: AuctionStatus.PENDING,
  durationHours: 24,
  firstBidAt: null,
  closesAt: null,
  paymentDeadline: null,
  currentWinnerId: null,
  settledAt: null,
  owner: { id: faker.string.uuid() } as any,
  bids: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createAuctionDto = (
  overrides?: Partial<CreateAuctionDto>,
): CreateAuctionDto => ({
  title: faker.commerce.productName(),
  description: faker.commerce.productDescription(),
  startingPrice: 100,
  durationHours: 24,
  ...overrides,
});

// test/factories/user.factory.ts
import { faker } from '@faker-js/faker';
import { UserEntity } from '@modules/users/entities/user.entity';
import { Role } from '@common/enums/role.enum';

export const createUserEntity = (
  overrides?: Partial<UserEntity>,
): UserEntity => ({
  id: faker.string.uuid(),
  email: faker.internet.email().toLowerCase(),
  password: '$2b$12$hashedpassword',  // Never real passwords in tests
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  roles: [Role.BIDDER],
  refreshTokenHash: null,
  failedLoginAttempts: 0,
  isLocked: false,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});
```

---

## Integration Test — Repository Pattern

```typescript
// src/modules/bids/bids.repository.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BidsRepository } from './bids.repository';
import { BidEntity } from './entities/bid.entity';
import { AuctionEntity } from '@modules/auctions/entities/auction.entity';
import { UserEntity } from '@modules/users/entities/user.entity';
import { BidStatus } from '@common/enums/bid-status.enum';
import { AuctionStatus } from '@common/enums/auction-status.enum';
import { createUserEntity } from '@test/factories/user.factory';
import { createAuctionEntity } from '@test/factories/auction.factory';
import { resetTestDatabase, seedTestData } from '@test/helpers/db.helper';

describe('BidsRepository (integration)', () => {
  let repository: BidsRepository;
  let dataSource: DataSource;
  let testUserId: string;
  let testAuctionId: string;

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
          entities: [BidEntity, AuctionEntity, UserEntity],
          synchronize: false,
          logging: false,
        }),
        TypeOrmModule.forFeature([BidEntity]),
      ],
      providers: [BidsRepository],
    }).compile();

    repository = module.get<BidsRepository>(BidsRepository);
    dataSource = module.get<DataSource>(DataSource);

    // Reset DB and seed base data once before all tests in suite
    await resetTestDatabase(dataSource);
    const seedData = await seedTestData(dataSource);
    testUserId = seedData.userId;
    testAuctionId = seedData.auctionId;
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  // Use transactions to isolate each test — rollback after
  let queryRunner: any;
  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  describe('findCurrentHighestBid', () => {
    it('should return the highest ACCEPTED bid for an auction', async () => {
      // Arrange — create bids directly via queryRunner
      await queryRunner.manager.save(BidEntity, {
        amount: '100.00',
        status: BidStatus.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      });
      await queryRunner.manager.save(BidEntity, {
        amount: '200.00',
        status: BidStatus.ACCEPTED,
        auction: { id: testAuctionId },
        bidder: { id: testUserId },
      });

      // Act
      const result = await repository.findCurrentHighestBid(testAuctionId);

      // Assert
      expect(result).not.toBeNull();
      expect(parseFloat(result!.amount)).toBe(200);
      expect(result!.status).toBe(BidStatus.ACCEPTED);
    });

    it('should return null when no ACCEPTED bids exist', async () => {
      const result = await repository.findCurrentHighestBid(
        'non-existent-auction-id',
      );
      expect(result).toBeNull();
    });
  });
});
```

---

## E2E Test — Full HTTP Flow

```typescript
// test/bids.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { resetTestDatabase } from './helpers/db.helper';
import { generateTestToken } from './helpers/auth.helper';
import { createBidDto } from './factories/bid.factory';
import { Role } from '../src/common/enums/role.enum';
import { DataSource } from 'typeorm';

describe('BidsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let bidderToken: string;
  let auctioneerToken: string;
  let testAuctionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Register same global pipes as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    await resetTestDatabase(dataSource);

    // Generate test tokens — real JWT tokens
    bidderToken = generateTestToken({
      sub: 'bidder-user-id',
      email: 'bidder@test.com',
      roles: [Role.BIDDER],
      permissions: ['bid:create', 'bid:view'],
    });

    auctioneerToken = generateTestToken({
      sub: 'auctioneer-user-id',
      email: 'auctioneer@test.com',
      roles: [Role.AUCTIONEER],
      permissions: ['auction:create', 'auction:view'],
    });

    // Create test auction via API
    const auctionRes = await request(app.getHttpServer())
      .post('/api/v1/auctions')
      .set('Authorization', `Bearer ${auctioneerToken}`)
      .send({
        title: 'Test Auction',
        startingPrice: 100,
        durationHours: 24,
      });

    testAuctionId = auctionRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/bids', () => {
    it('should place a valid bid and return 201', async () => {
      const dto = createBidDto({ auctionId: testAuctionId, amount: 150 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send(dto)
        .expect(201);

      expect(res.body).toMatchObject({
        data: {
          amount: 150,
          auctionId: testAuctionId,
        },
        meta: null,
        error: null,
      });
    });

    it('should return 401 when no token provided', async () => {
      const dto = createBidDto({ auctionId: testAuctionId, amount: 200 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .send(dto)
        .expect(401);

      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should return 403 when auctioneer tries to bid', async () => {
      const dto = createBidDto({ auctionId: testAuctionId, amount: 200 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send(dto)
        .expect(403);

      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 400 with field errors on invalid DTO', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ amount: -50 })     // Missing auctionId, negative amount
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.fields).toBeInstanceOf(Array);
      expect(res.body.error.fields.length).toBeGreaterThan(0);
    });

    it('should return standard { data, meta, error } envelope', async () => {
      const dto = createBidDto({ auctionId: testAuctionId, amount: 300 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send(dto)
        .expect(201);

      // Always verify envelope shape
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBeNull();
    });
  });
});
```

---

## Test Helpers

```typescript
// test/helpers/db.helper.ts
import { DataSource } from 'typeorm';

export async function resetTestDatabase(
  dataSource: DataSource,
): Promise<void> {
  // Drop all tables and re-run migrations
  await dataSource.dropDatabase();
  await dataSource.runMigrations();
}

export async function seedTestData(
  dataSource: DataSource,
): Promise<{ userId: string; auctionId: string }> {
  // Minimal seed for integration tests
  const userRepo = dataSource.getRepository('UserEntity');
  const auctionRepo = dataSource.getRepository('AuctionEntity');

  const user = await userRepo.save({
    email: 'test@example.com',
    password: '$2b$12$hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    roles: ['BIDDER'],
  });

  const auction = await auctionRepo.save({
    title: 'Test Auction',
    startingPrice: '100.00',
    durationHours: 24,
    status: 'ACTIVE',
    owner: user,
  });

  return { userId: user.id, auctionId: auction.id };
}

// test/helpers/auth.helper.ts
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../src/common/types/jwt-payload.type';

export function generateTestToken(payload: JwtPayload): string {
  const jwtService = new JwtService({
    secret: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret',
  });
  return jwtService.sign(payload);
}
```

---

## Forbidden Patterns — Never Do These

```typescript
// ❌ jest.spyOn on private methods
jest.spyOn(service as any, 'privateMethod');

// ❌ Mocks defined inside describe or it blocks
describe('BidsService', () => {
  const mockRepo = { findById: jest.fn() };  // Wrong — module scope only
});

// ❌ Hardcoded test data — always use factories
const bid = { id: '123', amount: '100' };    // Wrong

// ❌ Missing afterEach(jest.clearAllMocks)
// Every test file must have this

// ❌ Real DB calls in unit tests
mockBidsRepository.findById.mockImplementation(
  async (id) => realRepo.findById(id),       // Wrong — no real DB in unit
);

// ❌ Testing implementation details
expect(mockBidsRepository.create).toHaveBeenCalledTimes(1);  // Fragile

// ❌ Improvised mocking patterns
jest.mock('./bids.repository');                // Wrong — use useValue pattern

// ❌ No randomize — tests must not depend on order
// randomize: true is set in jest.config.ts — never remove it
```

---

## Coverage Requirements

| Path | Minimum Coverage |
|---|---|
| All code | 80% statements, branches, functions, lines |
| `BidsService.placeBid` | 100% branch coverage |
| `AuctionsService` state transitions | 100% branch coverage |
| Payment fallback chain logic | 100% branch coverage |
| `JwtAuthGuard` | 100% branch coverage |
| `PermissionsGuard` | 100% branch coverage |

---

## Testing Checklist

Before marking any feature done verify:

  ✅ Unit test file exists co-located with service
  ✅ Integration test file exists co-located with repository
  ✅ E2E test covers full HTTP flow for new endpoints
  ✅ Standard mock pattern used — no improvised patterns
  ✅ All mocks defined at module scope
  ✅ afterEach(jest.clearAllMocks) present
  ✅ Factories used for all test data — no hardcoded values
  ✅ randomize: true in jest.config.ts — never removed
  ✅ All branches of service methods covered
  ✅ Exception cases tested — not just happy path
  ✅ Event emission asserted on successful operations
  ✅ Transaction rollback tested on DB failure
  ✅ E2E tests verify { data, meta, error } envelope shape
  ✅ E2E tests verify error codes in error responses
  ✅ npm run test passes with zero failures
  ✅ Coverage thresholds met