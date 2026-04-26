---
name: code-review
description: >
  Use this skill when the user asks to review code, check code against
  the project rules, validate a PR, or audit any file before committing.
  Triggers include: "review this code", "check this against our rules",
  "validate this PR", "audit this file", "does this follow our standards",
  "check if this is correct", "review before I commit", "is this right",
  "code review for X", "check my service", "review my controller".
  Always read this skill before reviewing any file or code snippet.
---

# Skill: code-review

## References — Read Before Starting

Always read the relevant references for the files being reviewed:

- [SKILL.md] — master checklist, open decisions, project context
- [references/conventions.md] — naming, file structure, TypeScript rules
- [references/project-structure.md] — correct file locations
- [references/typeorm-patterns.md] — entity and repository patterns
- [references/response-standards.md] — response envelope rules
- [references/error-handling.md] — exception usage
- [references/rbac.md] — guard and permission usage
- [references/logging.md] — log statement quality
- [references/cls-context.md] — CLS usage
- [references/testing-standards.md] — test quality
- [references/swagger-standards.md] — Swagger decorator completeness
- [references/bidding-domain.md] — domain rule correctness

---

## Step 0 — Identify Files to Review

Before reviewing ask if not provided:
- Which files are being reviewed?
- Is this a full module or a specific file?
- Is there a specific concern to focus on?

Read each file fully before starting the review.
Never comment on code you haven't read.

---

## Step 1 — Review Structure

Run through these sections in order.
Report ALL violations found — never stop at the first one.
Group findings by severity:

🔴 CRITICAL   — Must fix before merge. Breaks functionality,
security risk, or violates core architecture.
🟡 WARNING    — Should fix. Violates project standards but
does not break functionality immediately.
🟢 SUGGESTION — Nice to have. Minor improvement or style issue.

---

## Step 2 — TypeScript & Code Quality Checks

```typescript
// Check every file for:

// 🔴 No `any` types — zero tolerance
const data: any = ...;                    // CRITICAL

// 🔴 All functions have explicit return types
async function doSomething() {}           // CRITICAL — missing return type
async function doSomething(): Promise<void> {} // Correct

// 🔴 No floating promises
someAsyncFunction();                      // CRITICAL — not awaited
await someAsyncFunction();                // Correct

// 🔴 No console.log / console.error / console.warn
console.log('something');                 // CRITICAL — use Logger

// 🔴 No process.env outside config/
const secret = process.env.JWT_SECRET;   // CRITICAL outside config/

// 🟡 No unused variables or imports
import { UnusedModule } from '...';       // WARNING

// 🟡 prefer-const — use const where value never changes
let count = 0;  // WARNING if count is never reassigned

// 🟡 Always === never ==
if (value == null) {}                    // WARNING — use ===

// 🟢 Explicit types on all variables where inference is ambiguous
const result = someFunction();           // SUGGESTION — add type annotation
```

---

## Step 3 — Architecture & Layer Checks

```typescript
// 🔴 No business logic in controllers
@Post()
async create(@Body() dto: CreateBidDto) {
  // Validation logic here                // CRITICAL — belongs in service
  if (dto.amount <= 0) throw new Error();
  return this.bidsService.create(dto);
}

// 🔴 No DB queries in services
@Injectable()
export class BidsService {
  async placeBid(dto: CreateBidDto) {
    // Direct TypeORM call in service     // CRITICAL — belongs in repository
    const bid = await this.dataSource
      .getRepository(BidEntity)
      .save(dto);
  }
}

// 🔴 No cross-module direct imports
// bids.service.ts importing from auctions internals
import { AuctionEntity } from '../auctions/entities/auction.entity';
// CRITICAL — import AuctionsService and let it expose what's needed

// 🔴 No skipped layers — controller must call service, service calls repo
// controller calling repository directly                // CRITICAL

// 🟡 No shared logic duplicated across modules
// Same utility function in two different modules        // WARNING
// Move to common/utils/

// 🟢 Constructor dependencies in correct order
constructor(
  private readonly bidsRepository: BidsRepository,
  private readonly configService: ConfigService,  // alphabetical? optional
) {}
```

---

## Step 4 — Entity & Repository Checks

```typescript
// 🔴 Entity must extend BaseEntity
@Entity('bids')
export class BidEntity {                 // CRITICAL — missing extends BaseEntity
  @PrimaryGeneratedColumn('uuid')
  id: string;
}

// 🔴 No float for monetary values
@Column({ type: 'float' })              // CRITICAL
amount: number;

@Column({ type: 'decimal', precision: 18, scale: 2 }) // Correct
amount: string;

// 🔴 No timestamptz missing on timestamp columns
@Column({ type: 'timestamp' })          // CRITICAL — must be timestamptz
createdAt: Date;

// 🔴 No missing column name mapping
@Column()                               // CRITICAL — must have name: 'snake_case'
startingPrice: string;

@Column({ name: 'starting_price', type: 'decimal', precision: 18, scale: 2 })
startingPrice: string;                  // Correct

// 🔴 No synchronize: true anywhere
synchronize: true,                      // CRITICAL — always false

// 🔴 FK columns must have @Index
@ManyToOne(() => AuctionEntity)
@JoinColumn({ name: 'auction_id' })     // CRITICAL — missing @Index
auction: AuctionEntity;

// 🔴 No hard deletes
await this.repo.delete(id);             // CRITICAL — use softDelete
await this.repo.softDelete(id);         // Correct

// 🟡 No eager loading globally
@ManyToOne(() => UserEntity, { eager: true }) // WARNING

// 🟡 QueryBuilder queries must be parameterized
.where(`bid.auction_id = '${auctionId}'`) // WARNING — SQL injection risk
.where('bid.auction_id = :auctionId', { auctionId }) // Correct
```

---

## Step 5 — API & Response Checks

```typescript
// 🔴 All responses must follow { data, meta, error } envelope
// Services returning pre-wrapped responses               // CRITICAL
return { data: result, meta: null, error: null };  // Wrong — service wraps
return result;                                     // Correct — interceptor wraps

// 🔴 No sensitive fields in responses
return {
  id: user.id,
  password: user.password,              // CRITICAL — never expose
  refreshTokenHash: user.refreshTokenHash, // CRITICAL
};

// 🔴 No decimal string amounts in responses
return { amount: bid.amount };          // CRITICAL if amount is '150.00' string
return { amount: parseFloat(bid.amount) }; // Correct

// 🔴 Missing @RequirePermissions on protected routes
@Post('bids')                           // CRITICAL — no permission check
async placeBid() {}

// 🔴 Missing @Public() on public routes
@Get('auctions')                        // CRITICAL if meant to be public
async findAll() {}

// 🟡 Missing Swagger decorators
@Get(':id')
@ApiOperation({ summary: '...' })       // Present — good
// Missing @ApiResponse()               // WARNING

// 🟡 POST missing @HttpCode(201)
@Post()                                 // WARNING — defaults to 200
async create() {}

// 🟡 DELETE missing @HttpCode(204) and void return
@Delete(':id')
async remove(): Promise<string> {       // WARNING — should return void / 204
  return 'deleted';
}

// 🟢 Missing @ApiParam on path params
@Get(':id')                             // SUGGESTION
async findOne(@Param('id') id: string) {}
```

---

## Step 6 — Error Handling Checks

```typescript
// 🔴 Raw HttpException thrown from service
throw new HttpException('Not found', 404);    // CRITICAL
throw new ResourceNotFoundException('Bid');   // Correct

// 🔴 Empty catch blocks
try {
  await this.repo.save(entity);
} catch (error) {
  // Empty — swallows error              // CRITICAL
}

// 🔴 Stack traces or DB errors exposed to client
catch (error) {
  return { error: error.message };       // CRITICAL — may expose internals
}

// 🔴 Using raw string error codes
throw new BaseException('my_error', ...) // CRITICAL — use ErrorCodes registry

// 🟡 Try/catch in controller
@Post()
async create(@Body() dto) {
  try {                                  // WARNING — let filter handle it
    return await this.service.create(dto);
  } catch (e) {
    throw new HttpException(...);
  }
}

// 🟢 Missing domain exception for a business rule violation
if (!auction) return null;              // SUGGESTION — throw NotFoundException
```

---

## Step 7 — Auth & Security Checks

```typescript
// 🔴 Ownership check in controller
@Patch(':id/close')
async close(@Param('id') id, @CurrentUser() user) {
  if (auction.ownerId !== user.sub) {   // CRITICAL — belongs in service
    throw new ForbiddenException();
  }
}

// 🔴 Ownership check missing ADMIN bypass
if (auction.owner.id !== userId) {      // CRITICAL — ADMIN must bypass
  throw new AuctionOwnershipException();
}
// Correct:
const isAdmin = userRoles.includes(Role.ADMIN);
if (!isAdmin && auction.owner.id !== userId) { ... }

// 🔴 Token or password in log statement
this.logger.log('Login', { password: dto.password }); // CRITICAL

// 🔴 process.env access outside config/
const secret = process.env.JWT_SECRET;  // CRITICAL — use ConfigService

// 🟡 Missing rate limiting on auth endpoints
@Post('login')                          // WARNING — should have @Throttle()
@Public()
async login() {}

// 🟢 Hardcoded magic numbers
if (attempts >= 10) { ... }            // SUGGESTION — use constant or config
```

---

## Step 8 — Logging Checks

```typescript
// 🔴 console.log anywhere
console.log('Bid placed');              // CRITICAL

// 🔴 String interpolation in log statements
this.logger.log(`Bid ${bidId} by ${userId}`); // CRITICAL — use structured

// 🔴 Sensitive data in logs
this.logger.log('Auth', { password }); // CRITICAL

// 🟡 Missing requestId in log context
this.logger.log('Bid placed', {
  bidId,                               // WARNING — missing requestId
});
// Correct:
this.logger.log('Bid placed', {
  requestId: this.cls.get('requestId'),
  userId:    this.cls.get('userId'),
  bidId,
});

// 🟡 Wrong log level for the event
this.logger.error('Bid placed successfully'); // WARNING — should be log/info

// 🟢 Logger not using class name as context
private readonly logger = new Logger('bids'); // SUGGESTION
private readonly logger = new Logger(BidsService.name); // Correct
```

---

## Step 9 — CLS Usage Checks

```typescript
// 🔴 Direct request object access for user identity
async someMethod(@Req() req: Request) {
  const userId = req.user.sub;          // CRITICAL — use CLS
}
// Correct:
const userId = this.cls.get<string>('userId');

// 🔴 CLS used in event handler without null check
const requestId = this.cls.get('requestId'); // CRITICAL in handler — null
// Correct in handlers:
const jobId = uuidv4(); // Use jobId in async context

// 🟡 Missing default when reading nullable CLS fields
const userId = this.cls.get<string>('userId'); // WARNING — could be null
const userId = this.cls.get<string>('userId') ?? null; // Correct

// 🟡 Setting CLS values outside JwtStrategy or middleware
this.cls.set('userId', id); // WARNING — only JwtStrategy should set these
```

---

## Step 10 — Test Quality Checks

```typescript
// 🔴 Mocks defined inside describe blocks
describe('Service', () => {
  const mockRepo = { findById: jest.fn() }; // CRITICAL — module scope only
});

// 🔴 Missing afterEach(jest.clearAllMocks)
describe('Service', () => {             // CRITICAL
  // No afterEach
});

// 🔴 Hardcoded test data instead of factories
const bid = { id: '123', amount: '150' }; // CRITICAL — use factories

// 🔴 jest.spyOn on private methods
jest.spyOn(service as any, 'privateMethod'); // CRITICAL

// 🔴 Real DB calls in unit tests
mockRepo.findById.mockImplementation(
  async (id) => realDataSource.findOne(id), // CRITICAL

// 🟡 Tests only cover happy path — no exception cases
describe('placeBid', () => {
  it('should place bid', ...);           // WARNING — only happy path
  // Missing: not found, wrong state, self-bid, etc.
});

// 🟡 Over-specified assertions
expect(mock.create).toHaveBeenCalledTimes(1); // WARNING — fragile

// 🟢 Test names don't follow 'should X when Y' convention
it('test bid placement', ...);          // SUGGESTION
it('should place bid when amount exceeds current highest', ...); // Correct
```

---

## Step 11 — Domain Logic Checks (Bids Bazzar Specific)

```typescript
// 🔴 Bid state machine violation
bid.status = BidStatus.DRAFT;           // CRITICAL if bid was ACCEPTED

// 🔴 Auction state transition not validated
auction.status = AuctionStatus.SETTLED; // CRITICAL — must use transitionState()

// 🔴 Missing self-bidding check
async placeBid(dto, userId) {
  // No check if userId === auction.owner.id  // CRITICAL

// 🔴 Float arithmetic on monetary values
const newAmount = currentBid + dto.amount; // CRITICAL — use parseFloat carefully

// 🔴 Hardcoded payment window
const deadline = new Date(now + 18 * 3600000); // CRITICAL — use ConfigService
const hours = this.config.get('domain.paymentWindowHours', 18); // Correct

// 🟡 Missing closesAt null check when auction is PENDING
if (new Date() > auction.closesAt) {    // WARNING — closesAt is null in PENDING

// 🟢 Event not emitted after state transition
await this.auctionsRepository.update(id, { status: AuctionStatus.CLOSED });
// Missing: eventEmitter.emit(EventNames.AUCTION_CLOSED, ...)  // SUGGESTION
```

---

## Step 12 — Final Quality Gate Checks

```bash
# These must all pass before any code is merged
npm run lint       # Must show zero errors, zero warnings
npm run build      # Must compile with zero TypeScript errors
npm run test       # All unit tests must pass
npm run test:coverage  # Coverage thresholds must be met
```

---

## Step 13 — Review Report Format

Always structure the review output like this:

Code Review — <FileName(s)>
🔴 Critical Issues (must fix before merge)

1. [File: bids.service.ts, Line: 42]
Issue: Direct DB query in service layer.
Rule: Business logic in services, DB access in repositories (Rule 1).
Fix: Move dataSource.getRepository(BidEntity).find() to BidsRepository.
2. [File: bids.controller.ts, Line: 18]
Issue: Missing @RequirePermissions() on POST /bids.
Rule: All protected routes must declare required permissions (Rule 5).
Fix: Add @RequirePermissions(Permission.BID_CREATE).

🟡 Warnings (should fix)

1. [File: bids.service.ts, Line: 67]
Issue: Log statement missing requestId from CLS.
Rule: All log statements must include requestId (Rule 9).
Fix: Add requestId: this.cls.get('requestId') to log context.

🟢 Suggestions (nice to have)

1. [File: bids.service.ts, Line: 31]
Issue: Return type could be more specific.
Suggestion: Change Promise<any> to Promise<BidResponseDto>.

✅ Passed Checks

1. No any types found
2. All entities extend BaseEntity
3. Soft deletes used correctly
4. Standard mock pattern in tests
5. afterEach(jest.clearAllMocks) present

📋 Summary
Critical: 2 | Warnings: 1 | Suggestions: 1
Verdict: ❌ NOT READY TO MERGE — resolve critical issues first.

---

## Step 14 — Verdict Rules

❌ NOT READY TO MERGE
→ Any 🔴 Critical issue exists
→ npm run lint fails
→ npm run build fails
→ Any unit test fails

⚠️ MERGE WITH CAUTION
→ No Critical issues
→ One or more 🟡 Warnings exist
→ All gates pass

✅ READY TO MERGE
→ No Critical issues
→ No Warnings (or all acknowledged)
→ All quality gates pass
→ Coverage thresholds met