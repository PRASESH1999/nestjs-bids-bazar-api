---
name: create-exception
description: >
  Use this skill when the user asks to create a new exception class,
  add a new error, or add a new error code. Triggers include: "create
  a new exception for X", "add a BidExpiredException", "I need a new
  error for Y", "add an error code for Z", "create a domain exception
  for X", "add a new error when Y happens", "I need to throw a custom
  error for Z". Always read this skill before creating any exception
  class or adding any error code.
---

# Skill: create-exception

## References — Read Before Starting

- [SKILL.md] — project context, open decisions
- [references/error-handling.md] — BaseException pattern,
  error codes registry, HTTP status codes
- [references/conventions.md] — naming rules
- [references/testing-standards.md] — how to test exceptions

---

## Step 0 — Extract Exception Details

Before writing any code confirm:

| Detail | Extract From Request |
|---|---|
| Exception name | What is the domain concept? |
| Error code | UPPER_SNAKE_CASE constant |
| HTTP status | 400 / 401 / 403 / 404 / 409 / 422 / 500? |
| Message | User-facing message — no technical details |
| Context | Which service throws this? What condition? |
| Parameters | Does the message need dynamic values? |

Use this table to pick the right HTTP status:

| Status | When |
|---|---|
| 400 | Malformed request — client error |
| 401 | Not authenticated |
| 403 | Authenticated but not permitted |
| 404 | Resource does not exist |
| 409 | State conflict or business rule violation |
| 422 | Passes validation but fails domain rule |
| 500 | Unexpected server error |

---

## Step 1 — Check Error Codes Registry First

Before creating a new exception always check:
`src/common/exceptions/error-codes.ts`

Never create a duplicate error code.
Never use a raw string error code anywhere.
If a similar exception already exists — use it, don't create a new one.

---

## Step 2 — Add to Error Codes Registry

```typescript
// src/common/exceptions/error-codes.ts
// Add the new error code in the correct section

export const ErrorCodes = {
  // ... existing codes ...

  // ── <Section Name> ───────────────────────────────────────────────────
  <ERROR_CODE>: {
    code:        '<ERROR_CODE>',           // UPPER_SNAKE_CASE
    statusCode:  <HTTP_STATUS>,            // number
    description: '<What this error means>',
    thrownBy:    '<ServiceName>.<methodName>',
  },
} as const;
```

---

## Step 3 — Create Exception Class File

```typescript
// src/common/exceptions/<kebab-case-name>.exception.ts
import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class <PascalCaseName>Exception extends BaseException {
  constructor() {
    super(
      ErrorCodes.<ERROR_CODE>.code,
      '<User-facing message — no technical details, no stack traces>',
      HttpStatus.<STATUS_CONSTANT>,
    );
  }
}
```

### With Dynamic Message Parameter
```typescript
// Use when the message needs context-specific values
export class BidIncrementViolationException extends BaseException {
  constructor(minIncrement: number) {
    super(
      ErrorCodes.BID_INCREMENT_VIOLATION.code,
      `Bid must be at least ${minIncrement} above the current highest bid.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// Use when resource name needs to be dynamic
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

## Step 4 — HTTP Status Constants Reference

```typescript
// Always use HttpStatus enum — never raw numbers

HttpStatus.BAD_REQUEST            // 400
HttpStatus.UNAUTHORIZED           // 401
HttpStatus.FORBIDDEN              // 403
HttpStatus.NOT_FOUND              // 404
HttpStatus.CONFLICT               // 409
HttpStatus.UNPROCESSABLE_ENTITY   // 422
HttpStatus.TOO_MANY_REQUESTS      // 429
HttpStatus.INTERNAL_SERVER_ERROR  // 500
```

---

## Step 5 — Export from Barrel File

```typescript
// src/common/exceptions/index.ts
// Add export at the end of the file

export * from './<kebab-case-name>.exception';
```

---

## Step 6 — Register Throw Location in Error Codes

Always update the `thrownBy` field in error-codes.ts
to show exactly which service and method throws this exception:

```typescript
// ✅ Specific — easy to find in codebase
thrownBy: 'BidsService.placeBid',

// ✅ Multiple locations
thrownBy: 'BidsService.placeBid, AuctionsService.transitionState',

// ❌ Too vague
thrownBy: 'BidsService',
```

---

## Step 7 — Add Unit Test for New Exception

Add a test case to the relevant service spec file
to verify the exception is thrown under the correct condition:

```typescript
// In the relevant *.service.spec.ts file
// Add inside the correct describe block

it('should throw <PascalCaseName>Exception when <condition>', async () => {
  // Arrange — set up mocks for the failing condition
  const entity = create<Name>Entity({
    // Set up state that triggers this exception
  });
  mock<Name>Repository.findById.mockResolvedValue(entity);

  // Act + Assert
  await expect(
    service.<methodName>(<args>),
  ).rejects.toThrow(<PascalCaseName>Exception);

  // Verify no side effects occurred
  expect(mock<Name>Repository.update).not.toHaveBeenCalled();
  expect(mockEventEmitter.emit).not.toHaveBeenCalled();
});
```

---

## Step 8 — Update references/error-handling.md

After creating the exception add it to the domain section
in `references/error-handling.md`:

```markdown
// src/common/exceptions/<kebab-case-name>.exception.ts
export class <Name>Exception extends BaseException {
  constructor() {
    super(
      ErrorCodes.<ERROR_CODE>.code,
      '<message>',
      HttpStatus.<STATUS>,
    );
  }
}
```

---

## Step 9 — Complete Example

```typescript
// Example: Creating a new AuctionReserveNotMetException

// ── Step 1: Add to error-codes.ts ─────────────────────────────────────
AUCTION_RESERVE_NOT_MET: {
  code:        'AUCTION_RESERVE_NOT_MET',
  statusCode:  422,
  description: 'Final bid did not meet the reserve price',
  thrownBy:    'AuctionsService.settleAuction',
},

// ── Step 2: Create exception class ────────────────────────────────────
// src/common/exceptions/auction-reserve-not-met.exception.ts
import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class AuctionReserveNotMetException extends BaseException {
  constructor(reservePrice: number, highestBid: number) {
    super(
      ErrorCodes.AUCTION_RESERVE_NOT_MET.code,
      `The highest bid of ${highestBid} did not meet the reserve price of ${reservePrice}.`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// ── Step 3: Export from barrel ─────────────────────────────────────────
// src/common/exceptions/index.ts
export * from './auction-reserve-not-met.exception';

// ── Step 4: Use in service ─────────────────────────────────────────────
// src/modules/auctions/auctions.service.ts
if (highestBid < auction.reservePrice) {
  throw new AuctionReserveNotMetException(
    parseFloat(auction.reservePrice),
    highestBid,
  );
}

// ── Step 5: Unit test ──────────────────────────────────────────────────
it('should throw AuctionReserveNotMetException when reserve not met',
  async () => {
    const auction = createAuctionEntity({
      reservePrice: '1000.00',
      currentHighestBid: '500.00',
      status: AuctionStatus.CLOSED,
    });
    mockAuctionsRepository.findById.mockResolvedValue(auction);

    await expect(
      service.settleAuction(auction.id),
    ).rejects.toThrow(AuctionReserveNotMetException);
  },
);
```

---

## Step 10 — Message Writing Rules

```typescript
// ✅ Good messages — user-facing, clear, no technical details
'This auction is no longer accepting bids.'
'You cannot place a bid on your own auction.'
'Your session has expired. Please log in again.'
'The requested auction was not found.'
'Bid must be at least 10 above the current highest bid.'

// ❌ Bad messages — technical, vague, or scary
'AuctionEntity not found in repository'          // Technical
'Error 23505: duplicate key value'               // DB error
'Something went wrong'                           // Vague
'Bid validation failed at line 42 in service'   // Stack info
'Cannot read property of undefined'             // JS error
```

---

## Step 11 — Final Checklist

  ✅ Error code checked in error-codes.ts — no duplicate
  ✅ New error code added to error-codes.ts with all fields
  ✅ thrownBy field accurate — service.method format
  ✅ Exception class file created in common/exceptions/
  ✅ File named: <kebab-case-name>.exception.ts
  ✅ Class named: <PascalCaseName>Exception
  ✅ Extends BaseException — never HttpException directly
  ✅ Uses ErrorCodes constant — never raw string
  ✅ Uses HttpStatus enum — never raw number
  ✅ Message is user-friendly — no technical details
  ✅ Exported from common/exceptions/index.ts barrel
  ✅ Unit test added for the throwing condition
  ✅ references/error-handling.md updated
  ✅ npm run lint — zero errors
  ✅ npm run build — zero TypeScript errors
  ✅ npm run test — exception test passes