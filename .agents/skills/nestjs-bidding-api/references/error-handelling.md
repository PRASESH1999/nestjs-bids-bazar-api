# Error Handling Reference

> Read this before throwing any exception, adding any error handling,
> creating any exception class, or modifying the global exception filter.
> All errors must follow the standard envelope — no exceptions.

---

## Core Principles

- Never expose internal errors, stack traces, or DB errors to API consumers.
- All errors return { data: null, meta: null, error: { code, message, statusCode } }
- Every error has a machine-readable code (UPPER_SNAKE_CASE) and human-readable message.
- Error handling is centralized — GlobalExceptionFilter handles everything.
- Never handle errors ad-hoc inside controllers or services with try/catch
  unless converting a TypeORM error to a domain exception.
- Empty catch blocks are forbidden — always log and rethrow at minimum.

---

## Error Response Envelope

```typescript
// Every error response — always this exact shape, no deviations
{
  "data": null,
  "meta": null,
  "error": {
    "code": "AUCTION_CLOSED",
    "message": "This auction is no longer accepting bids.",
    "statusCode": 409,

    // Only present for VALIDATION_FAILED errors
    "fields": [
      { "field": "amount", "message": "amount must be a positive number" },
      { "field": "auctionId", "message": "auctionId must be a UUID" }
    ]
  }
}
```

---

## Base Exception Class

```typescript
// src/common/exceptions/base.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class BaseException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    statusCode: HttpStatus,
  ) {
    super({ errorCode, message, statusCode }, statusCode);
  }
}
```

---

## Error Codes Registry

```typescript
// src/common/exceptions/error-codes.ts
// Single source of truth for ALL error codes in the Bids Bazzar.
// Every error code must be registered here before use.
// Never use a raw string error code anywhere else in the codebase.

export const ErrorCodes = {

  // ── Bid Errors ───────────────────────────────────────────────────────
  BID_BELOW_MINIMUM: {
    code: 'BID_BELOW_MINIMUM',
    statusCode: 422,
    description: 'Bid amount is not above the current highest bid',
    thrownBy: 'BidsService.placeBid',
  },
  BID_INCREMENT_VIOLATION: {
    code: 'BID_INCREMENT_VIOLATION',
    statusCode: 422,
    description: 'Bid does not meet the minimum increment requirement',
    thrownBy: 'BidsService.placeBid',
  },
  DUPLICATE_LEADING_BID: {
    code: 'DUPLICATE_LEADING_BID',
    statusCode: 409,
    description: 'Bidder already holds the current highest bid',
    thrownBy: 'BidsService.placeBid',
  },
  SELF_BIDDING_NOT_ALLOWED: {
    code: 'SELF_BIDDING_NOT_ALLOWED',
    statusCode: 403,
    description: 'Auction owner cannot bid on their own auction',
    thrownBy: 'BidsService.placeBid',
  },

  // ── Auction Errors ───────────────────────────────────────────────────
  AUCTION_CLOSED: {
    code: 'AUCTION_CLOSED',
    statusCode: 409,
    description: 'Auction timer has expired — no more bids accepted',
    thrownBy: 'BidsService.placeBid, AuctionsService',
  },
  AUCTION_NOT_ACTIVE: {
    code: 'AUCTION_NOT_ACTIVE',
    statusCode: 409,
    description: 'Auction is not in ACTIVE state',
    thrownBy: 'BidsService.placeBid',
  },
  AUCTION_NOT_FOUND: {
    code: 'AUCTION_NOT_FOUND',
    statusCode: 404,
    description: 'Auction does not exist or has been soft deleted',
    thrownBy: 'AuctionsService',
  },
  AUCTION_OWNERSHIP_REQUIRED: {
    code: 'AUCTION_OWNERSHIP_REQUIRED',
    statusCode: 403,
    description: 'Only the auction owner or ADMIN can perform this action',
    thrownBy: 'AuctionsService',
  },
  INVALID_AUCTION_STATE: {
    code: 'INVALID_AUCTION_STATE',
    statusCode: 409,
    description: 'Auction state transition is not allowed',
    thrownBy: 'AuctionsService',
  },

  // ── Auth Errors ──────────────────────────────────────────────────────
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    statusCode: 401,
    description: 'Email or password is incorrect',
    thrownBy: 'AuthService.login',
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    statusCode: 401,
    description: 'Access or refresh token has expired',
    thrownBy: 'JwtAuthGuard, AuthService.refreshTokens',
  },
  REFRESH_TOKEN_REUSED: {
    code: 'REFRESH_TOKEN_REUSED',
    statusCode: 401,
    description: 'Refresh token reuse detected — all tokens invalidated',
    thrownBy: 'AuthService.refreshTokens',
  },
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    statusCode: 403,
    description: 'Account locked after too many failed login attempts',
    thrownBy: 'AuthService.login',
  },
  INSUFFICIENT_PERMISSIONS: {
    code: 'INSUFFICIENT_PERMISSIONS',
    statusCode: 403,
    description: 'User does not have required permissions for this action',
    thrownBy: 'PermissionsGuard',
  },

  // ── Payment Errors ───────────────────────────────────────────────────
  PAYMENT_WINDOW_EXPIRED: {
    code: 'PAYMENT_WINDOW_EXPIRED',
    statusCode: 409,
    description: 'Payment window has expired — fallback triggered',
    thrownBy: 'AuctionsService.processPaymentExpiry',
  },
  NO_REMAINING_BIDDERS: {
    code: 'NO_REMAINING_BIDDERS',
    statusCode: 409,
    description: 'All bidders in fallback chain have defaulted',
    thrownBy: 'AuctionsService.processPaymentExpiry',
  },

  // ── Generic Errors ───────────────────────────────────────────────────
  RESOURCE_NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    statusCode: 404,
    description: 'Requested resource does not exist',
    thrownBy: 'Any service findById method',
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    statusCode: 400,
    description: 'Request body or query params failed DTO validation',
    thrownBy: 'GlobalExceptionFilter (ValidationPipe errors)',
  },
  DUPLICATE_RESOURCE: {
    code: 'DUPLICATE_RESOURCE',
    statusCode: 409,
    description: 'A resource with this unique value already exists',
    thrownBy: 'GlobalExceptionFilter (PG error 23505)',
  },
  RESOURCE_REFERENCE_CONFLICT: {
    code: 'RESOURCE_REFERENCE_CONFLICT',
    statusCode: 409,
    description: 'Resource is referenced by another record',
    thrownBy: 'GlobalExceptionFilter (PG error 23503)',
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    statusCode: 500,
    description: 'Unexpected database error — logged internally',
    thrownBy: 'GlobalExceptionFilter (QueryFailedError)',
  },
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
    description: 'Unexpected server error',
    thrownBy: 'GlobalExceptionFilter (unhandled exceptions)',
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
```

---

## Domain Exception Classes

```typescript
// ── Bid Exceptions ───────────────────────────────────────────────────────

// src/common/exceptions/bid-below-minimum.exception.ts
import { BaseException } from './base.exception';
import { HttpStatus } from '@nestjs/common';
import { ErrorCodes } from './error-codes';

export class BidBelowMinimumException extends BaseException {
  constructor() {
    super(
      ErrorCodes.BID_BELOW_MINIMUM.code,
      'Bid amount must be greater than the current highest bid.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// src/common/exceptions/bid-increment-violation.exception.ts
export class BidIncrementViolationException extends BaseException {
  constructor(minIncrement: number) {
    super(
      ErrorCodes.BID_INCREMENT_VIOLATION.code,
      `Bid must be at least ${minIncrement} above the current highest bid.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// src/common/exceptions/duplicate-leading-bid.exception.ts
export class DuplicateLeadingBidException extends BaseException {
  constructor() {
    super(
      ErrorCodes.DUPLICATE_LEADING_BID.code,
      'You already hold the highest bid on this auction.',
      HttpStatus.CONFLICT,
    );
  }
}

// src/common/exceptions/self-bidding.exception.ts
export class SelfBiddingException extends BaseException {
  constructor() {
    super(
      ErrorCodes.SELF_BIDDING_NOT_ALLOWED.code,
      'You cannot place a bid on your own auction.',
      HttpStatus.FORBIDDEN,
    );
  }
}

// ── Auction Exceptions ───────────────────────────────────────────────────

// src/common/exceptions/auction-closed.exception.ts
export class AuctionClosedException extends BaseException {
  constructor() {
    super(
      ErrorCodes.AUCTION_CLOSED.code,
      'This auction is no longer accepting bids.',
      HttpStatus.CONFLICT,
    );
  }
}

// src/common/exceptions/auction-not-active.exception.ts
export class AuctionNotActiveException extends BaseException {
  constructor() {
    super(
      ErrorCodes.AUCTION_NOT_ACTIVE.code,
      'This auction is not currently active.',
      HttpStatus.CONFLICT,
    );
  }
}

// src/common/exceptions/auction-not-found.exception.ts
export class AuctionNotFoundException extends BaseException {
  constructor() {
    super(
      ErrorCodes.AUCTION_NOT_FOUND.code,
      'The requested auction was not found.',
      HttpStatus.NOT_FOUND,
    );
  }
}

// src/common/exceptions/auction-ownership.exception.ts
export class AuctionOwnershipException extends BaseException {
  constructor() {
    super(
      ErrorCodes.AUCTION_OWNERSHIP_REQUIRED.code,
      'You do not have permission to perform this action on this auction.',
      HttpStatus.FORBIDDEN,
    );
  }
}

// src/common/exceptions/invalid-auction-state.exception.ts
export class InvalidAuctionStateException extends BaseException {
  constructor(current: string, attempted: string) {
    super(
      ErrorCodes.INVALID_AUCTION_STATE.code,
      `Cannot transition auction from ${current} to ${attempted}.`,
      HttpStatus.CONFLICT,
    );
  }
}

// ── Auth Exceptions ──────────────────────────────────────────────────────

// src/common/exceptions/invalid-credentials.exception.ts
export class InvalidCredentialsException extends BaseException {
  constructor() {
    super(
      ErrorCodes.INVALID_CREDENTIALS.code,
      'The email or password you entered is incorrect.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

// src/common/exceptions/token-expired.exception.ts
export class TokenExpiredException extends BaseException {
  constructor() {
    super(
      ErrorCodes.TOKEN_EXPIRED.code,
      'Your session has expired. Please log in again.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

// src/common/exceptions/refresh-token-reused.exception.ts
export class RefreshTokenReusedException extends BaseException {
  constructor() {
    super(
      ErrorCodes.REFRESH_TOKEN_REUSED.code,
      'Invalid session detected. Please log in again.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

// src/common/exceptions/account-locked.exception.ts
export class AccountLockedException extends BaseException {
  constructor() {
    super(
      ErrorCodes.ACCOUNT_LOCKED.code,
      'Your account has been locked. Please contact support.',
      HttpStatus.FORBIDDEN,
    );
  }
}

// src/common/exceptions/insufficient-permissions.exception.ts
export class InsufficientPermissionsException extends BaseException {
  constructor() {
    super(
      ErrorCodes.INSUFFICIENT_PERMISSIONS.code,
      'You do not have permission to perform this action.',
      HttpStatus.FORBIDDEN,
    );
  }
}

// ── Payment Exceptions ───────────────────────────────────────────────────

// src/common/exceptions/payment-window-expired.exception.ts
export class PaymentWindowExpiredException extends BaseException {
  constructor() {
    super(
      ErrorCodes.PAYMENT_WINDOW_EXPIRED.code,
      'The payment window has expired.',
      HttpStatus.CONFLICT,
    );
  }
}

// src/common/exceptions/no-remaining-bidders.exception.ts
export class NoRemainingBiddersException extends BaseException {
  constructor() {
    super(
      ErrorCodes.NO_REMAINING_BIDDERS.code,
      'All bidders in the fallback chain have defaulted. Auction abandoned.',
      HttpStatus.CONFLICT,
    );
  }
}

// ── Generic Exceptions ───────────────────────────────────────────────────

// src/common/exceptions/resource-not-found.exception.ts
export class ResourceNotFoundException extends BaseException {
  constructor(resource?: string) {
    super(
      ErrorCodes.RESOURCE_NOT_FOUND.code,
      resource
        ? `${resource} was not found.`
        : 'The requested resource was not found.',
      HttpStatus.NOT_FOUND,
    );
  }
}
```

---

## Error Handling Rules Per Layer

### Controller Layer
```typescript
// ✅ Never wrap in try/catch — let GlobalExceptionFilter handle it
@Post('bids')
@RequirePermissions(Permission.BID_CREATE)
async placeBid(
  @Body() dto: CreateBidDto,
  @CurrentUser() user: JwtPayload,
): Promise<BidEntity> {
  return this.bidsService.placeBid(dto, user.sub);  // Exceptions bubble up
}

// ❌ Never do this in a controller
async placeBid(@Body() dto: CreateBidDto): Promise<BidEntity> {
  try {
    return await this.bidsService.placeBid(dto);
  } catch (error) {
    throw new HttpException('Something went wrong', 500);  // Wrong
  }
}
```

### Service Layer
```typescript
// ✅ Throw domain exceptions directly for business rule violations
async placeBid(dto: CreateBidDto, userId: string): Promise<BidEntity> {
  const auction = await this.auctionsRepository.findById(dto.auctionId);
  if (!auction) throw new AuctionNotFoundException();

  if (auction.status !== AuctionStatus.ACTIVE) {
    throw new AuctionNotActiveException();
  }

  if (auction.owner.id === userId) {
    throw new SelfBiddingException();
  }

  // Convert TypeORM errors to domain exceptions where needed
  try {
    return await this.bidsRepository.create({ ...dto, bidderId: userId });
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      throw new ResourceNotFoundException('Bid');
    }
    throw error;  // Rethrow unexpected errors
  }
}

// ❌ Never throw raw HttpException from services
throw new HttpException('Auction closed', 409);    // Wrong
throw new NotFoundException('Auction not found');  // Wrong
```

### Repository Layer
```typescript
// ✅ Never catch exceptions in repositories
// Exception: transaction rollback — always rethrow after
async createWithTransaction(data: Partial<BidEntity>): Promise<BidEntity> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const bid = await queryRunner.manager.save(BidEntity, data);
    await queryRunner.commitTransaction();
    return bid;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;   // Always rethrow — never swallow
  } finally {
    await queryRunner.release();
  }
}
```

---

## Adding a New Exception — Checklist

When adding any new exception class, always do ALL of the following:

  ✅ Add error code to ErrorCodes registry in error-codes.ts
  ✅ Create exception class in common/exceptions/
  ✅ Extend BaseException — never extend HttpException directly
  ✅ Use the exact error code from ErrorCodes registry
  ✅ Write a clear, user-friendly message — no technical details
  ✅ Export from common/exceptions/index.ts barrel file
  ✅ Add to this reference file under the correct section
  ✅ Add unit test asserting the exception is thrown correctly

---

## Common Exceptions Barrel Export

```typescript
// src/common/exceptions/index.ts
// Export all exceptions from single entry point
export * from './base.exception';
export * from './error-codes';
export * from './bid-below-minimum.exception';
export * from './bid-increment-violation.exception';
export * from './duplicate-leading-bid.exception';
export * from './self-bidding.exception';
export * from './auction-closed.exception';
export * from './auction-not-active.exception';
export * from './auction-not-found.exception';
export * from './auction-ownership.exception';
export * from './invalid-auction-state.exception';
export * from './invalid-credentials.exception';
export * from './token-expired.exception';
export * from './refresh-token-reused.exception';
export * from './account-locked.exception';
export * from './insufficient-permissions.exception';
export * from './payment-window-expired.exception';
export * from './no-remaining-bidders.exception';
export * from './resource-not-found.exception';
```

---

## HTTP Status Code Reference

| Code | When to Use | Example |
|---|---|---|
| 200 | Successful GET, PATCH, DELETE | Bid retrieved |
| 201 | Successful POST | Bid placed |
| 204 | Successful DELETE, no body | Bid soft deleted |
| 400 | DTO validation failure | Missing required field |
| 401 | Missing or invalid token | Token expired |
| 403 | Authenticated but not permitted | Self bidding |
| 404 | Resource not found | Auction not found |
| 409 | State or business rule conflict | Auction closed |
| 422 | Passes validation, fails business rule | Bid below minimum |
| 429 | Rate limit exceeded | Too many login attempts |
| 500 | Unexpected server error | DB connection failed |