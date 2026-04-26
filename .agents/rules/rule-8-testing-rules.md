---
trigger: always_on
---

# Rule 8: Testing Rules

## Core Philosophy
- Every module must be independently testable from day one — testability is a design
  requirement, not an afterthought.
- Prefer real integrations over mocks wherever practical — mocks are the last resort,
  not the default.
- AI tools generating tests must follow these rules exactly — no improvised mocking
  patterns, no inline jest.fn() scattered arbitrarily.
- Tests are first-class citizens — a feature is not done until its tests pass.

## Test Types & When to Use Each

### Unit Tests
- Test a single class (service, repository, guard, pipe) in complete isolation.
- Use for: business logic in services, validation rules, exception throwing,
  state machine transitions, helper utilities.
- Mock only direct dependencies injected via constructor — nothing else.
- Never unit test controllers directly — they are covered by e2e tests.

### Integration Tests
- Test a full module with real DB (test PostgreSQL instance) — no mocked repositories.
- Use for: repository queries, transaction behaviour, TypeORM entity relations,
  migration correctness.
- Every repository must have integration tests — no exceptions.
- Run against a dedicated test database that is reset between test suites.

### End-to-End (E2E) Tests
- Test the full HTTP request → response cycle via NestJS test server.
- Use for: full bid placement flow, auction lifecycle, auth flows, error responses,
  response envelope shape.
- Critical flows that MUST have e2e tests:
    POST /bids                            (full bid placement)
    Auction PENDING → ACTIVE transition   (first bid placed)
    Auction ACTIVE → CLOSED transition    (timer expiry)
    Payment window start → fallback chain
    Auth login → access protected route
    Validation failure → correct error envelope
    Ownership rule enforcement

## Folder Structure
- Unit + integration tests: co-located with source file
    bids.service.ts → bids.service.spec.ts
    bids.repository.ts → bids.repository.integration.spec.ts
- E2E tests: live in a top-level test/ folder
    test/
    ├── bids.e2e.spec.ts
    ├── auctions.e2e.spec.ts
    └── auth.e2e.spec.ts
- Test helpers and factories: test/helpers/ and test/factories/
    test/
    ├── helpers/
    │   ├── db.helper.ts        # DB reset, seed, teardown utilities
    │   └── auth.helper.ts      # Token generation for test requests
    └── factories/
        ├── bid.factory.ts      # Creates test bid data
        ├── auction.factory.ts  # Creates test auction data
        └── user.factory.ts     # Creates test user data

## The Mocking Rules (Critical — follow exactly to avoid mocking hell)

### What TO Mock
Only mock things that are:
  1. External services (email, push notifications, payment providers)
  2. Time-dependent behaviour (Date.now(), timers, scheduled jobs)
  3. Third-party HTTP calls (OAuth providers, external APIs)
  4. Queue/event emission (assert events are emitted, not their side effects)

### What NEVER to Mock
  - Repositories in integration tests — use real DB
  - TypeORM entities or relations — use real DB
  - NestJS guards in e2e tests — use real tokens
  - ConfigService — use a real test config
  - Other services within the same module under test

### How to Mock (Standard Patterns — AI must follow these exactly)

#### Mocking a Service Dependency in a Unit Test
// Always use this pattern — never jest.fn() inline on the class
const mockEmailService = {
  sendWinnerNotification: jest.fn().mockResolvedValue(undefined),
  sendOutbidNotification: jest.fn().mockResolvedValue(undefined),
};

// In TestingModule providers:
{
  provide: EmailService,
  useValue: mockEmailService,
}

// Reset between tests:
beforeEach(() => jest.clearAllMocks());

#### Mocking Time (for payment window and auction closing tests)
// Always use jest timer mocks — never manually manipulate Date
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// Advance time explicitly in tests:
jest.advanceTimersByTime(18 * 60 * 60 * 1000); // advance 18 hours

#### Mocking Event Emission
// Mock the EventBus/EventEmitter — assert events emitted, not their handlers
const mockEventBus = { emit: jest.fn() };
{
  provide: EventBus,
  useValue: mockEventBus,
}
// Assert:
expect(mockEventBus.emit).toHaveBeenCalledWith(
  EventNames.BID_ACCEPTED,
  expect.objectContaining({ bidId: expect.any(String) })
);

#### Never Do This (forbidden mocking patterns)
  ❌ jest.spyOn(service, 'method').mockImplementation(...)  // inside describe blocks
  ❌ Mocking the repository in unit tests of the repository itself
  ❌ Partial mocks of TypeORM entities
  ❌ Re-declaring mocks inside individual it() blocks
  ❌ Using any as mock return type

## Test Data — Always Use Factories
- Never hardcode test data inline in test files.
- Always use factory functions from test/factories/:

// test/factories/bid.factory.ts
export const createBidDto = (overrides?: Partial<CreateBidDto>): CreateBidDto => ({
  auctionId: faker.string.uuid(),
  amount: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
  ...overrides,
});

export const createBidEntity = (overrides?: Partial<Bid>): Bid => ({
  id: faker.string.uuid(),
  status: BidStatus.SUBMITTED,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

- Use @faker-js/faker for all test data generation — never hardcoded strings or numbers.
- Factories accept overrides so edge cases are easy to test:
  createBidEntity({ status: BidStatus.REJECTED })
  createBidEntity({ amount: 0 }) // test invalid amount

## Test Naming Convention
- Describe block: the class or endpoint being tested
- Nested describe: the method or scenario
- It block: should + expected behaviour in plain English

describe('BidsService', () => {
  describe('placeBid', () => {
    it('should accept a valid bid above the current highest bid', ...)
    it('should reject a bid below the current highest bid', ...)
    it('should reject a bid on a closed auction', ...)
    it('should reject a bid placed by the auction owner', ...)
    it('should reject a bid if bidder already holds the highest bid', ...)
    it('should emit bid.accepted event on successful bid', ...)
  });
});

## Database Setup for Integration & E2E Tests
- Use a dedicated test PostgreSQL database — never run tests against dev or prod DB.
- Environment variable: NODE_ENV=test must point to test DB config.
- Reset DB state between test suites using db.helper.ts:
    Drop and recreate schema before each suite (not each test — too slow)
    Run migrations fresh on each suite start
    Seed only what the suite needs via factories
- Use transactions per test where possible — roll back after each test for speed.

## Coverage Requirements
- Minimum thresholds enforced in Jest config — CI fails if not met:
    Statements : 80%
    Branches   : 80%
    Functions  : 85%
    Lines      : 80%
- Critical paths require 100% branch coverage:
    BidsService.placeBid (all validation branches)
    AuctionsService state transitions
    Payment fallback chain logic
    JwtAuthGuard and PermissionsGuard

## Jest Configuration Rules
- Single jest.config.ts at project root.
- Separate projects for unit, integration, and e2e:
    unit        : **/*.spec.ts         (fast, no DB)
    integration : **/*.integration.spec.ts  (requires test DB)
    e2e         : test/**/*.e2e.spec.ts     (requires full app)
- Run order in CI: unit → integration → e2e
- Unit tests must complete in under 30 seconds — if slower, something is wrong.
- Always set testTimeout to 10000ms for integration and e2e tests.
- Always set randomize: true — tests must never depend on execution order.

## AI Tool Guidelines for Test Generation
When using AI tools to generate tests, always provide this context:
  1. The class under test and its constructor dependencies
  2. The mock pattern to use (from this rule — standard patterns above)
  3. The factory to use for test data
  4. The specific method and all its branches to cover
  5. Expected exceptions with their error codes

AI must never:
  - Invent its own mocking patterns outside the standards defined here
  - Use jest.spyOn on private methods
  - Create mocks inside individual it() blocks
  - Skip the beforeEach(jest.clearAllMocks) setup
  - Generate tests without using factories for test data