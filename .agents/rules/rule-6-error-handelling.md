---
trigger: always_on
---

# Rule 6: Error Handling

## Core Principles
- Never expose internal error details, stack traces, or DB errors to API consumers.
- All errors must follow the standard response envelope defined in Rule 2:
    { data: null, meta: null, error: { code, message, statusCode } }
- Every error has a machine-readable code (UPPER_SNAKE_CASE) and a human-readable message.
- Error handling is centralized — never handle errors ad-hoc inside controllers or services.

## Global Exception Filter
- Implement a single GlobalExceptionFilter in common/filters/global-exception.filter.ts
- Register it globally in main.ts via app.useGlobalFilters()
- It must catch and handle:
    HttpException         : All NestJS HTTP exceptions
    Domain exceptions     : All custom business rule exceptions
    TypeORM exceptions    : DB errors (map to safe API responses)
    Unhandled exceptions  : Any unexpected error → always return 500

## Custom Exception Classes
- All custom exceptions live in common/exceptions/
- Every custom exception extends a base class HttpException with a domain error code.
- Base structure:

// common/exceptions/base.exception.ts
export class BaseException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    statusCode: number,
  ) {
    super({ errorCode, message, statusCode }, statusCode);
  }
}

## Domain Exception Classes
Define the following exceptions — add new ones as domain grows:

// Bid exceptions
BidBelowMinimumException        → 422  BID_BELOW_MINIMUM
BidIncrementViolationException  → 422  BID_INCREMENT_VIOLATION
DuplicateLeadingBidException    → 409  DUPLICATE_LEADING_BID
SelfBiddingException            → 403  SELF_BIDDING_NOT_ALLOWED
AuctionClosedException          → 409  AUCTION_CLOSED
AuctionNotActiveException       → 409  AUCTION_NOT_ACTIVE

// Auction exceptions
AuctionNotFoundException        → 404  AUCTION_NOT_FOUND
AuctionOwnershipException       → 403  AUCTION_OWNERSHIP_REQUIRED
InvalidAuctionStateException    → 409  INVALID_AUCTION_STATE

// Auth exceptions
InvalidCredentialsException     → 401  INVALID_CREDENTIALS
TokenExpiredException           → 401  TOKEN_EXPIRED
RefreshTokenReusedException     → 401  REFRESH_TOKEN_REUSED
AccountLockedException          → 403  ACCOUNT_LOCKED
InsufficientPermissionsException→ 403  INSUFFICIENT_PERMISSIONS

// Payment exceptions
PaymentWindowExpiredException   → 409  PAYMENT_WINDOW_EXPIRED
NoRemainingBiddersException     → 409  NO_REMAINING_BIDDERS

// Generic exceptions
ResourceNotFoundException       → 404  RESOURCE_NOT_FOUND
ValidationException             → 400  VALIDATION_FAILED

## Validation Errors
- Use NestJS global ValidationPipe in main.ts for all DTO validation.
- Validation errors must return 400 with a structured error body listing all
  failed fields — never just a generic "bad request".
- Format:
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed.",
    "statusCode": 400,
    "fields": [
      { "field": "amount", "message": "amount must be a positive number" },
      { "field": "auctionId", "message": "auctionId must be a UUID" }
    ]
  }
}

## TypeORM Error Mapping
Map common PostgreSQL/TypeORM errors in GlobalExceptionFilter — never leak DB errors:

  23505 (unique_violation)      → 409  DUPLICATE_RESOURCE
  23503 (foreign_key_violation) → 409  RESOURCE_REFERENCE_CONFLICT
  23502 (not_null_violation)    → 400  VALIDATION_FAILED
  QueryFailedError (general)    → 500  DATABASE_ERROR (log internally, safe msg to client)
  EntityNotFoundError           → 404  RESOURCE_NOT_FOUND

## Error Logging
- Log ALL errors internally with the following context:
    timestamp, errorCode, statusCode, message, stack trace,
    requestId (correlation ID), userId (if authenticated), endpoint, method
- Log levels:
    4xx errors  → warn level (client mistakes, not our fault)
    5xx errors  → error level (our fault, needs attention)
- Never log sensitive data in error context:
    No passwords, tokens, payment details, or raw bid amounts in plain text.
- Use the project logger (Winston/Pino) — never console.error.

## Error Handling Rules by Layer

### Controller Layer
- Never wrap controller methods in try/catch.
- Let all exceptions bubble up to GlobalExceptionFilter automatically.
- Controllers only call services — exception handling is not their responsibility.

### Service Layer
- Throw domain exceptions directly when business rules are violated.
- Do not catch and re-throw generic errors — let them bubble up.
- Only catch exceptions when you need to add context or convert to a domain exception:
  e.g. catch TypeORM EntityNotFoundError → throw AuctionNotFoundException

### Repository Layer
- Never catch exceptions — let TypeORM errors bubble up to GlobalExceptionFilter.
- Exception: wrap tra