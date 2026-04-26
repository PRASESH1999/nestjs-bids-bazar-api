---
name: write-e2e-test
description: >
  Use this skill when the user asks to write end-to-end tests for an
  endpoint, controller, or full HTTP flow. Triggers include: "write e2e
  tests for X", "add e2e tests for the bids endpoint", "test the full
  HTTP flow for Y", "write API tests for Z", "add e2e coverage for the
  auction close endpoint", "test the auth flow end to end", "write
  supertest tests for X". Always read this skill before writing any
  *.e2e.spec.ts file.
---

# Skill: write-e2e-test

## References — Read Before Starting

- [SKILL.md] — project context, stack, open decisions
- [references/testing-standards.md] — e2e setup, auth helpers,
  DB helpers, envelope assertions
- [references/response-standards.md] — { data, meta, error } envelope
- [references/error-handling.md] — error codes to assert
- [references/rbac.md] — roles, permissions, access matrix
- [references/conventions.md] — test naming conventions
- [references/swagger-standards.md] — HTTP status codes per method

---

## Step 0 — Extract Test Details

Before writing any test confirm:

| Detail | Extract From Request |
|---|---|
| Endpoint(s) to test | Which routes? (method + path) |
| Auth requirements | Public / BIDDER / AUCTIONEER / ADMIN? |
| Request shape | Body / Query / Path params? |
| Response shape | What does success return? |
| Error cases | What can go wrong? |
| Domain rules | Any business rules to verify end-to-end? |
| Existing e2e file | Does a spec file already exist for this module? |

If an e2e spec file already exists — read it fully before adding tests.
Never duplicate existing test cases.

---

## Step 1 — File Location

test/<module-name>.e2e.spec.ts
Examples:
test/bids.e2e.spec.ts
test/auctions.e2e.spec.ts
test/auth.e2e.spec.ts
test/users.e2e.spec.ts

One e2e file per module — never per endpoint.
Add new endpoint tests to the existing module e2e file.

---

## Step 2 — Standard E2E Test Structure

```typescript
// test/<name>.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { resetTestDatabase } from './helpers/db.helper';
import { generateTestToken } from './helpers/auth.helper';
import { Role } from '../src/common/enums/role.enum';

// Factories for request bodies
import {
  create<Name>Dto,
} from './factories/<name>.factory';

describe('<Name> (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // ── Auth tokens — one per role ───────────────────────────────────────
  let bidderToken: string;
  let auctioneerToken: string;
  let adminToken: string;

  // ── Test data IDs — set during beforeAll ─────────────────────────────
  let testAuctionId: string;
  let testBidId: string;

  // ── Global Setup ─────────────────────────────────────────────────────
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Register SAME global config as production
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Reset DB once before all tests in this suite
    await resetTestDatabase(dataSource);

    // Generate tokens for each role
    bidderToken = generateTestToken({
      sub:         'e2e-bidder-user-id-000000000001',
      email:       'bidder@e2e.test',
      roles:       [Role.BIDDER],
      permissions: ['bid:create', 'bid:view', 'bid:view:own',
                    'auction:view', 'user:view:own'],
    });

    auctioneerToken = generateTestToken({
      sub:         'e2e-auctioneer-user-id-00000001',
      email:       'auctioneer@e2e.test',
      roles:       [Role.AUCTIONEER],
      permissions: ['auction:create', 'auction:view', 'auction:update',
                    'auction:close', 'auction:cancel', 'bid:view'],
    });

    adminToken = generateTestToken({
      sub:         'e2e-admin-user-id-000000000001',
      email:       'admin@e2e.test',
      roles:       [Role.ADMIN],
      permissions: Object.values(Permission),
    });

    // Set up prerequisite data via API calls
    // Always use API — never insert directly to DB in e2e tests
    await setupTestData();
  });

  // ── Global Teardown ──────────────────────────────────────────────────
  afterAll(async () => {
    await app.close();
  });

  // ── Test data setup ──────────────────────────────────────────────────
  async function setupTestData(): Promise<void> {
    // Create users in DB (needed for FK constraints)
    await dataSource.query(`
      INSERT INTO users (id, email, password, first_name, last_name, roles,
                         is_locked, failed_login_attempts)
      VALUES
        ('e2e-bidder-user-id-000000000001', 'bidder@e2e.test',
         '$2b$12$placeholder', 'E2E', 'Bidder', ARRAY['BIDDER'], false, 0),
        ('e2e-auctioneer-user-id-00000001', 'auctioneer@e2e.test',
         '$2b$12$placeholder', 'E2E', 'Auctioneer', ARRAY['AUCTIONEER'], false, 0),
        ('e2e-admin-user-id-000000000001', 'admin@e2e.test',
         '$2b$12$placeholder', 'E2E', 'Admin', ARRAY['ADMIN'], false, 0)
      ON CONFLICT (id) DO NOTHING
    `);

    // Create auction via API
    const auctionRes = await request(app.getHttpServer())
      .post('/api/v1/auctions')
      .set('Authorization', `Bearer ${auctioneerToken}`)
      .send({
        title: 'E2E Test Auction',
        description: 'Created for e2e testing',
        startingPrice: 100,
        durationHours: 24,
      });

    testAuctionId = auctionRes.body.data.id;
  }

  // ── Test Groups Per Endpoint ─────────────────────────────────────────
  describe('POST /api/v1/<name>s', () => {
    // Test cases here
  });

  describe('GET /api/v1/<name>s', () => {
    // Test cases here
  });
});
```

---

## Step 3 — Auth Helper

```typescript
// test/helpers/auth.helper.ts
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../src/common/types/jwt-payload.type';

export function generateTestToken(payload: JwtPayload): string {
  const jwtService = new JwtService({
    secret: process.env.JWT_ACCESS_SECRET ?? 'test-access-secret',
  });

  return jwtService.sign(payload, {
    expiresIn: '1h',    // Long enough for test suite to complete
  });
}
```

---

## Step 4 — Test Case Templates Per Scenario

### Standard Success Cases

```typescript
// ── POST — 201 Created ─────────────────────────────────────────────────
it('should return 201 with created resource', async () => {
  const dto = create<Name>Dto({
    auctionId: testAuctionId,
    amount: 150,
  });

  const res = await request(app.getHttpServer())
    .post('/api/v1/<name>s')
    .set('Authorization', `Bearer ${bidderToken}`)
    .send(dto)
    .expect(201);

  // Always verify envelope shape
  expect(res.body).toMatchObject({
    data: expect.objectContaining({
      id:        expect.any(String),
      amount:    dto.amount,
      auctionId: dto.auctionId,
    }),
    meta:  null,
    error: null,
  });

  // Save for subsequent tests
  testBidId = res.body.data.id;
});

// ── GET single — 200 OK ────────────────────────────────────────────────
it('should return 200 with resource by ID', async () => {
  const res = await request(app.getHttpServer())
    .get(`/api/v1/<name>s/${testBidId}`)
    .set('Authorization', `Bearer ${bidderToken}`)
    .expect(200);

  expect(res.body).toMatchObject({
    data: expect.objectContaining({ id: testBidId }),
    meta:  null,
    error: null,
  });
});

// ── GET list — 200 with pagination ────────────────────────────────────
it('should return 200 with paginated list', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/v1/<name>s')
    .set('Authorization', `Bearer ${bidderToken}`)
    .query({ page: 1, limit: 10 })
    .expect(200);

  expect(res.body).toMatchObject({
    data:  expect.any(Array),
    meta: {
      page:       1,
      limit:      10,
      total:      expect.any(Number),
      totalPages: expect.any(Number),
    },
    error: null,
  });
});

// ── PATCH — 200 Updated ────────────────────────────────────────────────
it('should return 200 with updated resource', async () => {
  const res = await request(app.getHttpServer())
    .patch(`/api/v1/<name>s/${testBidId}`)
    .set('Authorization', `Bearer ${auctioneerToken}`)
    .send({ title: 'Updated Title' })
    .expect(200);

  expect(res.body).toMatchObject({
    data: expect.objectContaining({ id: testBidId }),
    meta:  null,
    error: null,
  });
});

// ── DELETE — 204 No Content ────────────────────────────────────────────
it('should return 204 on soft delete', async () => {
  await request(app.getHttpServer())
    .delete(`/api/v1/<name>s/${testBidId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(204);

  // Verify no longer accessible
  await request(app.getHttpServer())
    .get(`/api/v1/<name>s/${testBidId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(404);
});
```

### Auth Error Cases — Required on Every Protected Endpoint

```typescript
// ── 401 — No token ────────────────────────────────────────────────────
it('should return 401 when no Authorization header', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/<name>s')
    .send(create<Name>Dto())
    .expect(401);

  expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  expect(res.body.data).toBeNull();
});

// ── 401 — Invalid token ───────────────────────────────────────────────
it('should return 401 when token is invalid', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/<name>s')
    .set('Authorization', 'Bearer invalid.token.here')
    .send(create<Name>Dto())
    .expect(401);

  expect(res.body.error.code).toBe('TOKEN_EXPIRED');
});

// ── 403 — Wrong role ──────────────────────────────────────────────────
it('should return 403 when user lacks required permission', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${auctioneerToken}`)  // AUCTIONEER cannot bid
    .send(create<Name>Dto())
    .expect(403);

  expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
  expect(res.body.data).toBeNull();
});
```

### Validation Error Cases

```typescript
// ── 400 — Missing required field ──────────────────────────────────────
it('should return 400 with field errors when required field missing',
  async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/<name>s')
      .set('Authorization', `Bearer ${bidderToken}`)
      .send({})      // Empty body — missing all required fields
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields).toBeInstanceOf(Array);
    expect(res.body.error.fields.length).toBeGreaterThan(0);
    expect(res.body.data).toBeNull();
  },
);

// ── 400 — Invalid field type ──────────────────────────────────────────
it('should return 400 when amount is negative', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${bidderToken}`)
    .send({ auctionId: testAuctionId, amount: -50 })
    .expect(400);

  expect(res.body.error.code).toBe('VALIDATION_FAILED');
  const amountError = res.body.error.fields.find(
    (f: { field: string }) => f.field === 'amount',
  );
  expect(amountError).toBeDefined();
});

// ── 400 — Invalid UUID ────────────────────────────────────────────────
it('should return 400 when auctionId is not a valid UUID', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${bidderToken}`)
    .send({ auctionId: 'not-a-uuid', amount: 150 })
    .expect(400);

  expect(res.body.error.code).toBe('VALIDATION_FAILED');
});
```

### Business Rule Error Cases

```typescript
// ── 404 — Not found ───────────────────────────────────────────────────
it('should return 404 when resource does not exist', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/v1/<name>s/00000000-0000-0000-0000-000000000000')
    .set('Authorization', `Bearer ${bidderToken}`)
    .expect(404);

  expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  expect(res.body.data).toBeNull();
});

// ── 409 — Self bidding ────────────────────────────────────────────────
it('should return 403 when bidder tries to bid on own auction', async () => {
  // Create auction owned by bidder
  const ownAuctionRes = await request(app.getHttpServer())
    .post('/api/v1/auctions')
    .set('Authorization', `Bearer ${auctioneerToken}`)
    .send({
      title: 'Own Auction',
      startingPrice: 100,
      durationHours: 24,
    });

  // Try to bid as the owner — should fail
  // Note: bidder token sub must match auctioneer for this test
  // Use a dedicated self-bid scenario with matching user
  const res = await request(app.getHttpServer())
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${bidderToken}`)
    .send({
      auctionId: ownAuctionRes.body.data.id,
      amount: 150,
    })
    .expect(403);

  expect(res.body.error.code).toBe('SELF_BIDDING_NOT_ALLOWED');
});

// ── 409 — Auction closed ──────────────────────────────────────────────
it('should return 409 when bidding on closed auction', async () => {
  // Create and close an auction first
  const closedAuctionId = await createClosedAuction();

  const res = await request(app.getHttpServer())
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${bidderToken}`)
    .send({ auctionId: closedAuctionId, amount: 500 })
    .expect(409);

  expect(res.body.error.code).toBe('AUCTION_CLOSED');
});

// ── 422 — Bid below minimum ───────────────────────────────────────────
it('should return 422 when bid is below current highest', async () => {
  // Place a bid first
  await request(app.getHttpServer())
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${bidderToken}`)
    .send({ auctionId: testAuctionId, amount: 500 });

  // Try to bid lower
  const res = await request(app.getHttpServer())
    .post('/api/v1/bids')
    .set('Authorization', `Bearer ${bidderToken}`)
    .send({ auctionId: testAuctionId, amount: 200 })
    .expect(422);

  expect(res.body.error.code).toBe('BID_BELOW_MINIMUM');
});
```

---

## Step 5 — Complete E2E Test Suite Example

```typescript
// test/bids.e2e.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { resetTestDatabase } from './helpers/db.helper';
import { generateTestToken } from './helpers/auth.helper';
import { createBidDto } from './factories/bid.factory';
import { Role } from '../src/common/enums/role.enum';
import { Permission } from '../src/common/enums/permission.enum';

describe('Bids (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let bidderToken: string;
  let auctioneerToken: string;
  let adminToken: string;
  let testAuctionId: string;
  let placedBidId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    bidderToken = generateTestToken({
      sub:         'e2e-bidder-000000000001',
      email:       'bidder@e2e.test',
      roles:       [Role.BIDDER],
      permissions: [
        Permission.BID_CREATE, Permission.BID_VIEW,
        Permission.BID_VIEW_OWN, Permission.AUCTION_VIEW,
      ],
    });

    auctioneerToken = generateTestToken({
      sub:         'e2e-auctioneer-00000001',
      email:       'auctioneer@e2e.test',
      roles:       [Role.AUCTIONEER],
      permissions: [
        Permission.AUCTION_CREATE, Permission.AUCTION_VIEW,
        Permission.AUCTION_CLOSE, Permission.BID_VIEW,
      ],
    });

    adminToken = generateTestToken({
      sub:         'e2e-admin-000000000001',
      email:       'admin@e2e.test',
      roles:       [Role.ADMIN],
      permissions: Object.values(Permission),
    });

    // Seed users
    await dataSource.query(`
      INSERT INTO users (id, email, password, first_name, last_name,
                         roles, is_locked, failed_login_attempts)
      VALUES
        ('e2e-bidder-000000000001', 'bidder@e2e.test',
         '$2b$12$x', 'E2E', 'Bidder', ARRAY['BIDDER']::text[], false, 0),
        ('e2e-auctioneer-00000001', 'auctioneer@e2e.test',
         '$2b$12$x', 'E2E', 'Auctioneer', ARRAY['AUCTIONEER']::text[], false, 0),
        ('e2e-admin-000000000001', 'admin@e2e.test',
         '$2b$12$x', 'E2E', 'Admin', ARRAY['ADMIN']::text[], false, 0)
      ON CONFLICT (id) DO NOTHING
    `);

    // Create test auction
    const auctionRes = await request(app.getHttpServer())
      .post('/api/v1/auctions')
      .set('Authorization', `Bearer ${auctioneerToken}`)
      .send({
        title:        'E2E Test Auction',
        startingPrice: 100,
        durationHours: 24,
      });

    testAuctionId = auctionRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/v1/bids ─────────────────────────────────────────────────
  describe('POST /api/v1/bids', () => {
    it('should place a valid bid and return 201', async () => {
      const dto = createBidDto({ auctionId: testAuctionId, amount: 150 });

      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send(dto)
        .expect(201);

      expect(res.body).toMatchObject({
        data: expect.objectContaining({
          id:        expect.any(String),
          amount:    150,
          auctionId: testAuctionId,
        }),
        meta:  null,
        error: null,
      });

      placedBidId = res.body.data.id;
    });

    it('should activate auction on first bid', async () => {
      // Auction should now be ACTIVE after first bid
      const auctionRes = await request(app.getHttpServer())
        .get(`/api/v1/auctions/${testAuctionId}`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(200);

      expect(auctionRes.body.data.status).toBe('ACTIVE');
      expect(auctionRes.body.data.closesAt).not.toBeNull();
    });

    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .send(createBidDto({ auctionId: testAuctionId, amount: 200 }))
        .expect(401);

      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
      expect(res.body.data).toBeNull();
    });

    it('should return 403 when auctioneer tries to bid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send(createBidDto({ auctionId: testAuctionId, amount: 200 }))
        .expect(403);

      expect(res.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should return 400 with field errors on invalid DTO', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ amount: -50 })   // Missing auctionId, negative amount
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.fields).toBeInstanceOf(Array);
      expect(res.body.error.fields.length).toBeGreaterThan(0);
    });

    it('should return 422 when bid does not exceed current highest', async () => {
      // Current highest is 150 from first test
      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: testAuctionId, amount: 100 })
        .expect(422);

      expect(res.body.error.code).toBe('BID_BELOW_MINIMUM');
    });

    it('should return 409 when bidder already holds highest bid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId: testAuctionId, amount: 200 })
        .expect(409);

      expect(res.body.error.code).toBe('DUPLICATE_LEADING_BID');
    });
  });

  // ── GET /api/v1/bids ──────────────────────────────────────────────────
  describe('GET /api/v1/bids', () => {
    it('should return paginated bids list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        meta: {
          page:       1,
          limit:      10,
          total:      expect.any(Number),
          totalPages: expect.any(Number),
        },
        error: null,
      });
    });

    it('should return 401 when no token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/bids')
        .expect(401);
    });
  });

  // ── GET /api/v1/bids/:id ─────────────────────────────────────────────
  describe('GET /api/v1/bids/:id', () => {
    it('should return bid by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bids/${placedBidId}`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(placedBidId);
      expect(res.body.error).toBeNull();
    });

    it('should return 404 for non-existent bid', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bids/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bids/not-a-uuid')
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  // ── Response Envelope Verification ────────────────────────────────────
  describe('Response Envelope', () => {
    it('should always return { data, meta, error } envelope on success',
      async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/bids/${placedBidId}`)
          .set('Authorization', `Bearer ${bidderToken}`)
          .expect(200);

        // Strict envelope check
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toBeNull();
      },
    );

    it('should always return { data, meta, error } envelope on error',
      async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/bids/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${bidderToken}`)
          .expect(404);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).toHaveProperty('error');
        expect(res.body.data).toBeNull();
        expect(res.body.error.code).toBeDefined();
        expect(res.body.error.message).toBeDefined();
        expect(res.body.error.statusCode).toBeDefined();
      },
    );

    it('should include X-Request-Id header in every response', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/bids/${placedBidId}`)
        .set('Authorization', `Bearer ${bidderToken}`)
        .expect(200);

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f-]{36}$/,
      );
    });
  });

  // ── Critical Flow Tests ───────────────────────────────────────────────
  describe('Full Bid Placement Flow', () => {
    it('should handle multiple bidders competing correctly', async () => {
      // Create fresh auction
      const auctionRes = await request(app.getHttpServer())
        .post('/api/v1/auctions')
        .set('Authorization', `Bearer ${auctioneerToken}`)
        .send({ title: 'Flow Test Auction', startingPrice: 100, durationHours: 24 });

      const auctionId = auctionRes.body.data.id;

      // Bidder places first bid — activates auction
      const bid1 = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId, amount: 150 })
        .expect(201);

      expect(bid1.body.data.amount).toBe(150);

      // Create second bidder token
      await dataSource.query(`
        INSERT INTO users (id, email, password, first_name, last_name,
                           roles, is_locked, failed_login_attempts)
        VALUES ('e2e-bidder-2-00000000002', 'bidder2@e2e.test',
                '$2b$12$x', 'E2E', 'Bidder2', ARRAY['BIDDER']::text[], false, 0)
        ON CONFLICT (id) DO NOTHING
      `);

      const bidder2Token = generateTestToken({
        sub:         'e2e-bidder-2-00000000002',
        email:       'bidder2@e2e.test',
        roles:       [Role.BIDDER],
        permissions: [Permission.BID_CREATE, Permission.BID_VIEW,
                      Permission.AUCTION_VIEW],
      });

      // Second bidder outbids
      const bid2 = await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidder2Token}`)
        .send({ auctionId, amount: 200 })
        .expect(201);

      expect(bid2.body.data.amount).toBe(200);

      // First bidder tries to bid same amount — should fail
      await request(app.getHttpServer())
        .post('/api/v1/bids')
        .set('Authorization', `Bearer ${bidderToken}`)
        .send({ auctionId, amount: 200 })
        .expect(422);
    });
  });
});
```

---

## Step 6 — Critical Flows to Always Cover

Every e2e test suite must cover these flows:

```typescript
// ── For every endpoint ────────────────────────────────────────────────
// ✅ Success case with correct status code
// ✅ 401 — no token
// ✅ 401 — invalid token
// ✅ 403 — wrong role / insufficient permissions
// ✅ 400 — invalid DTO (missing fields, wrong types)
// ✅ 404 — resource not found
// ✅ Response envelope shape on success
// ✅ Response envelope shape on error
// ✅ X-Request-Id header present

// ── For POST endpoints additionally ──────────────────────────────────
// ✅ Returns 201 not 200
// ✅ Created resource in response body
// ✅ 409 for conflict/duplicate cases

// ── For domain action endpoints ───────────────────────────────────────
// ✅ State transition succeeds
// ✅ Invalid state transition returns 409
// ✅ Ownership violation returns 403
// ✅ Admin can bypass ownership

// ── For bidding domain specifically ──────────────────────────────────
// ✅ POST /bids — activates auction on first bid
// ✅ POST /bids — returns 422 on below-minimum bid
// ✅ POST /bids — returns 409 on duplicate leading bid
// ✅ POST /bids — returns 403 on self-bidding
// ✅ PATCH /auctions/:id/close — closes auction
// ✅ Full multi-bidder flow
```

---

## Step 7 — E2E Test Rules

```typescript
// ✅ One e2e file per module — not per endpoint
// ✅ Always use AppModule — never partial modules
// ✅ Always register same global pipes as production
// ✅ Always reset DB in beforeAll
// ✅ Generate tokens via generateTestToken — never hardcode JWT
// ✅ Create prerequisite data via API where possible
// ✅ Direct DB inserts only for FK constraints (users)
// ✅ Always verify { data, meta, error } envelope shape
// ✅ Always verify error.code on error responses
// ✅ Always verify X-Request-Id header
// ✅ Test state side effects (e.g. auction activated after first bid)
// ✅ Test critical full flows end-to-end

// ❌ Never mock services or repositories in e2e tests
// ❌ Never skip auth tests — they are mandatory
// ❌ Never use hardcoded JWT tokens
// ❌ Never test only happy path
// ❌ Never share state between describe blocks unsafely
// ❌ Never run e2e tests against dev or prod DB
```

---

## Step 8 — Final Checklist

  ✅ File saved to test/<name>.e2e.spec.ts
  ✅ AppModule imported — not partial module
  ✅ Same ValidationPipe config as production
  ✅ resetTestDatabase called in beforeAll
  ✅ Tokens generated for all required roles
  ✅ Test data created via API in beforeAll
  ✅ app.close() called in afterAll
  ✅ Every endpoint has 401 no-token test
  ✅ Every endpoint has 401 invalid-token test
  ✅ Every endpoint has 403 wrong-role test
  ✅ Every endpoint has 400 validation test
  ✅ Every endpoint has 404 not-found test
  ✅ Envelope shape verified on success responses
  ✅ Envelope shape verified on error responses
  ✅ X-Request-Id header verified
  ✅ error.code asserted on all error responses
  ✅ POST returns 201 not 200
  ✅ DELETE returns 204 and no body
  ✅ Critical domain flows tested end-to-end
  ✅ npm run test:e2e — all tests pass