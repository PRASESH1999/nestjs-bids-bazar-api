# Conventions Reference

> Read this before naming any file, class, variable, function,
> database table, column, or API endpoint.
> These conventions are enforced by ESLint, Prettier, and the
> pre-commit checklist. No exceptions.

---

## 1. File & Folder Naming

| What | Convention | Example |
|---|---|---|
| All files | kebab-case | `bid-response.dto.ts` |
| All folders | kebab-case | `common/exceptions/` |
| Module files | `<name>.module.ts` | `bids.module.ts` |
| Controller files | `<name>.controller.ts` | `bids.controller.ts` |
| Service files | `<name>.service.ts` | `bids.service.ts` |
| Repository files | `<name>.repository.ts` | `bids.repository.ts` |
| Entity files | `<name>.entity.ts` | `bid.entity.ts` |
| DTO files | `<action>-<name>.dto.ts` | `create-bid.dto.ts` |
| Interface files | `<name>.interface.ts` | `bid.interface.ts` |
| Guard files | `<name>.guard.ts` | `jwt-auth.guard.ts` |
| Filter files | `<name>.filter.ts` | `global-exception.filter.ts` |
| Interceptor files | `<name>.interceptor.ts` | `response.interceptor.ts` |
| Decorator files | `<name>.decorator.ts` | `current-user.decorator.ts` |
| Pipe files | `<name>.pipe.ts` | `validation.pipe.ts` |
| Handler files | `<event>.handler.ts` | `auction-closed.handler.ts` |
| Processor files | `<job>.processor.ts` | `auction-close.processor.ts` |
| Enum files | `<name>.enum.ts` | `bid-status.enum.ts` |
| Util files | `<name>.util.ts` | `pagination.util.ts` |
| Config files | `<name>.config.ts` | `database.config.ts` |
| Migration files | `<timestamp>-<PascalName>.ts` | `1714000000000-CreateBidsTable.ts` |
| Seed files | `<name>.seed.ts` | `auctions.seed.ts` |
| Factory files | `<name>.factory.ts` | `bid.factory.ts` |
| Unit test files | `<name>.service.spec.ts` | `bids.service.spec.ts` |
| Integration tests | `<name>.repository.integration.spec.ts` | `bids.repository.integration.spec.ts` |
| E2E test files | `<name>.e2e.spec.ts` | `bids.e2e.spec.ts` |

---

## 2. TypeScript Naming

| What | Convention | Example |
|---|---|---|
| Classes | PascalCase | `BidsService`, `CreateBidDto` |
| Interfaces | PascalCase, no `I` prefix | `BidResponse`, `AuctionState` |
| Type aliases | PascalCase | `PaginationMeta`, `JwtPayload` |
| Enums | PascalCase name | `BidStatus`, `AuctionStatus` |
| Enum values | UPPER_SNAKE_CASE | `BidStatus.PAYMENT_DEFAULTED` |
| Functions | camelCase | `placeBid()`, `findAuctionById()` |
| Variables | camelCase | `currentHighestBid`, `paymentDeadline` |
| Constants | UPPER_SNAKE_CASE | `MAX_BID_INCREMENT`, `PAYMENT_WINDOW_HOURS` |
| Private class fields | camelCase, no underscore | `private readonly bidsRepository` |
| Generic type params | Single PascalCase letter or descriptive | `T`, `TData`, `TResponse` |
| Boolean variables | camelCase, prefixed with is/has/can/should | `isActive`, `hasExpired`, `canBid` |

### Examples
```typescript
// ✅ Correct
class BidsService {}
interface BidResponse {}
type PaginationMeta = { total: number };
enum BidStatus { SUBMITTED = 'SUBMITTED' }
const MAX_BID_AMOUNT = 1_000_000;
function placeBid(dto: CreateBidDto): Promise<BidResponse> {}
const currentHighestBid = await this.bidsRepository.findHighest();
const isAuctionActive = auction.status === AuctionStatus.ACTIVE;

// ❌ Wrong
class bidsService {}             // lowercase
interface IBidResponse {}        // I prefix
type paginationMeta = {}         // lowercase
enum bid_status {}               // snake_case
const maxBidAmount = 1000000;    // should be UPPER_SNAKE_CASE constant
function PlaceBid() {}           // PascalCase function
const _privateField = '';        // underscore prefix
```

---

## 3. Database Naming

| What | Convention | Example |
|---|---|---|
| Table names | snake_case, plural | `bids`, `auction_items` |
| Column names | snake_case | `created_at`, `starting_price` |
| Primary keys | always `id` | `id` |
| Foreign keys | `<ref_table_singular>_id` | `auction_id`, `bidder_id` |
| Index names | `idx_<table>_<column(s)>` | `idx_bids_auction_id` |
| Enum types | `<entity>_<field>_enum` | `bid_status_enum` |
| Migration names | `<timestamp>-<PascalDescription>` | `1714000000000-CreateBidsTable` |

### TypeORM Column Mapping Rules
- Always map DB snake_case columns to TypeScript camelCase properties
- Always use `{ name: 'snake_case_name' }` in @Column() explicitly

```typescript
// ✅ Correct
@Column({ name: 'starting_price', type: 'decimal', precision: 18, scale: 2 })
startingPrice: string;

@Column({ name: 'closes_at', type: 'timestamptz' })
closesAt: Date;

@ManyToOne(() => UserEntity)
@JoinColumn({ name: 'bidder_id' })
@Index('idx_bids_bidder_id')
bidder: UserEntity;

// ❌ Wrong
@Column()
startingPrice: number;    // No name mapping, wrong type for monetary

@Column()
closesAt: Date;           // No name mapping, no timestamptz
```

---

## 4. API Endpoint Naming

| What | Convention | Example |
|---|---|---|
| Resource names | plural, kebab-case | `/bids`, `/auction-items` |
| Path params | camelCase in route, UUID only | `:auctionId`, `:bidId` |
| Query params | camelCase | `?sortBy=createdAt&order=asc` |
| Nested resources | `/parent/:parentId/child` | `/auctions/:auctionId/bids` |
| HTTP methods | match CRUD intent | GET=read, POST=create, PATCH=update |

```typescript
// ✅ Correct
@Get()                              // GET /api/v1/bids
@Get(':id')                         // GET /api/v1/bids/:id
@Post()                             // POST /api/v1/bids
@Patch(':id')                       // PATCH /api/v1/bids/:id
@Delete(':id')                      // DELETE /api/v1/bids/:id
@Get(':auctionId/bids')             // GET /api/v1/auctions/:auctionId/bids

// ❌ Wrong
@Post('createBid')                  // verb in URL
@Get('getBidById/:id')              // verb in URL
@Post('bid')                        // singular resource
@Delete('remove/:id')               // verb in URL
```

---

## 5. Class Organization Order

Always organize class members in this order — no exceptions:

```typescript
@Injectable()
export class ExampleService {
  // 1. Private readonly constants
  private readonly SOME_CONSTANT = 'value';

  // 2. Constructor with injected dependencies
  constructor(
    private readonly exampleRepository: ExampleRepository,
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
    private readonly logger: Logger,
  ) {}

  // 3. Public methods (alphabetical within each group)
  async findAll(): Promise<ExampleEntity[]> {}
  async findById(id: string): Promise<ExampleEntity> {}

  // 4. Private helper methods
  private validateSomething(): void {}
  private mapToResponse(): ExampleResponse {}
}
```

---

## 6. Import Order

Always follow this import order — enforced by `eslint-plugin-import`:

```typescript
// 1. Node.js built-ins (if any)
import { randomUUID } from 'crypto';

// 2. NestJS core
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

// 3. Third-party packages
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';

// 4. Internal — path aliases (alphabetical)
import { BaseEntity } from '@common/entities/base.entity';
import { Permission } from '@common/enums/permission.enum';
import { AuctionClosedException } from '@common/exceptions/auction-closed.exception';
import { AppConfig } from '@config/app.config';
import { BidsRepository } from '@modules/bids/bids.repository';

// 5. Relative imports (only within same module, avoid where possible)
import { CreateBidDto } from './dto/create-bid.dto';
import { BidEntity } from './entities/bid.entity';
```

---

## 7. DTO Conventions

```typescript
// ✅ Correct DTO pattern
export class CreateBidDto {
  // Every field has @ApiProperty first, then validators
  @ApiProperty({
    description: 'UUID of the auction to bid on',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  auctionId: string;

  @ApiProperty({
    description: 'Bid amount — must be greater than current highest bid',
    example: 150.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

// Update DTOs always extend PartialType
export class UpdateBidDto extends PartialType(CreateBidDto) {}

// Query DTOs always extend PaginationQueryDto where pagination is needed
export class ListBidsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BidStatus })
  @IsOptional()
  @IsEnum(BidStatus)
  status?: BidStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  auctionId?: string;
}
```

### DTO Rules
- Every field must have `@ApiProperty()` or `@ApiPropertyOptional()`
- Validators always come AFTER `@ApiProperty()`
- Optional fields use `@IsOptional()` as the FIRST validator after `@ApiProperty()`
- Never put business logic in DTOs — shape and format validation only
- Never use `any` as a DTO field type
- Use `@Type(() => Number)` for numeric query params (they arrive as strings)
- Use `PartialType` for update DTOs — never redefine fields manually

---

## 8. Enum Conventions

```typescript
// ✅ Correct — always string enums, UPPER_SNAKE_CASE values
// src/common/enums/bid-status.enum.ts
export enum BidStatus {
  DRAFT             = 'DRAFT',
  SUBMITTED         = 'SUBMITTED',
  ACCEPTED          = 'ACCEPTED',
  REJECTED          = 'REJECTED',
  PAYMENT_DEFAULTED = 'PAYMENT_DEFAULTED',
}

export enum AuctionStatus {
  PENDING           = 'PENDING',
  ACTIVE            = 'ACTIVE',
  CLOSED            = 'CLOSED',
  AWAITING_PAYMENT  = 'AWAITING_PAYMENT',
  SETTLED           = 'SETTLED',
  PAYMENT_FAILED    = 'PAYMENT_FAILED',
  ABANDONED         = 'ABANDONED',
}

// ❌ Wrong
enum bidStatus { draft, submitted }         // wrong casing
enum BidStatus { DRAFT = 1, SUBMITTED = 2 } // numeric enum — never use
```

### Enum Rules
- Always use string enums — never numeric
- Always define in `common/enums/` — never inline in entity or DTO
- Always use `@Column({ type: 'enum', enum: BidStatus })` in entities
- Always use `@IsEnum(BidStatus)` in DTOs for enum fields

---

## 9. Error & Exception Naming

```typescript
// ✅ Correct — PascalCase, descriptive, ends in Exception
BidBelowMinimumException
AuctionClosedException
PaymentWindowExpiredException
ResourceNotFoundException

// Error codes — UPPER_SNAKE_CASE always
'BID_BELOW_MINIMUM'
'AUCTION_CLOSED'
'PAYMENT_WINDOW_EXPIRED'
'RESOURCE_NOT_FOUND'

// ❌ Wrong
bidBelowMinimumError         // camelCase
BidBelowMinimumError         // should end in Exception
'bidBelowMinimum'            // error code not UPPER_SNAKE_CASE
```

---

## 10. Test Naming Conventions

```typescript
// describe → class or endpoint being tested
describe('BidsService', () => {

  // nested describe → method or scenario being tested
  describe('placeBid', () => {

    // it → should + expected behaviour in plain English
    it('should accept a valid bid above the current highest bid', ...);
    it('should throw AuctionClosedException when auction is not active', ...);
    it('should throw SelfBiddingException when bidder owns the auction', ...);
    it('should emit bid.accepted event on successful placement', ...);
    it('should reject a bid equal to the current highest bid', ...);
  });
});

// ❌ Wrong test naming
it('test bid placement', ...);       // does not start with should
it('works correctly', ...);          // not descriptive
it('placeBid success case', ...);    // not plain English
```

---

## 11. Comment Conventions

```typescript
// ✅ Use JSDoc for all public methods and classes
/**
 * Places a bid on an active auction.
 * Validates all domain rules before persisting.
 * Emits bid.accepted or bid.rejected event.
 *
 * @throws {AuctionClosedException} When auction is not in ACTIVE state
 * @throws {BidBelowMinimumException} When bid amount is not above current highest
 * @throws {SelfBiddingException} When bidder is the auction owner
 */
async placeBid(dto: CreateBidDto, userId: string): Promise<BidEntity> {}

// ✅ Use inline comments for non-obvious logic only
// Fallback chain rank: highest amount first, earliest timestamp as tiebreaker
const rankedBids = bids.sort((a, b) =>
  b.amount !== a.amount
    ? b.amount - a.amount
    : a.createdAt.getTime() - b.createdAt.getTime()
);

// ❌ Never comment obvious code
// Get bid by id
const bid = await this.bidsRepository.findById(id);

// ❌ Never leave TODO comments without a ticket reference
// TODO: fix this later
// ✅ Always reference a decision or ticket
// TODO [DECISION #7]: Replace with BullMQ when queue system is decided
```

---

## 12. ESLint & Prettier Config

### `.eslintrc.js`
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-unused-parameters': 'error',

    // Code style
    'no-console': 'error',
    'eqeqeq': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',

    // Imports
    'import/order': ['error', {
      'groups': [
        'builtin', 'external',
        'internal', 'parent',
        'sibling', 'index'
      ],
      'newlines-between': 'always',
      'alphabetize': { order: 'asc' },
    }],
    'import/no-circular': 'error',
  },
};
```

### `.prettierrc`
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "target": "ES2021",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./",
    "paths": {
      "@common/*": ["src/common/*"],
      "@config/*": ["src/config/*"],
      "@modules/*": ["src/modules/*"],
      "@database/*": ["src/database/*"],
      "@test/*": ["test/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### `tsconfig.build.json`
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```