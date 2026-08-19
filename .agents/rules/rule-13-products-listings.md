---
trigger: always_on
---

# Rule 13: Products / Listings

## Definition
- A Product is a single-quantity, one-of-a-kind item listed by a USER for auction.
- Each product belongs to exactly one Category and one Subcategory.
- Products are auctioned via bidding (logic implemented in a later module).
- One product = one auction = one winning buyer.

## Pricing Model
- User sets a base price (their desired sale price).
- The platform applies a **tiered margin** on top of `basePrice` — the lower the
  base price, the higher the margin. The markup is selected by which band the
  `basePrice` (in NPR) falls into:

  | `basePrice` (NPR)   | Markup |
  |---------------------|--------|
  | ≤ 10,000            | 20%    |
  | 10,001 – 20,000     | 18%    |
  | 20,001 – 30,000     | 16%    |
  | 30,001 – 40,000     | 14%    |
  | 40,001 – 50,000     | 12%    |
  | > 50,000            | 10%    |

- `biddingStartPrice = round(basePrice × (1 + markup), 2)` — rounded to 2 decimal
  places. The single source of truth is `ProductsService.computeBiddingStartPrice`.
- Both values are stored on the product:
    `basePrice`          : user-entered desired price
    `biddingStartPrice`  : auto-computed via the tiered markup above
- First bid must be ≥ `biddingStartPrice`.
- Bidding logic, countdown, and increments are governed by Rule 3: Bidding Domain
  Logic — do NOT duplicate that logic here.
- For the full bidding mechanics including increment rules, payment windows, auction
  closing logic, and the fallback payment chain, see
  **Rule 14: Bidding & Auction Lifecycle**.

### Instant Buy
- Every product also gets a fixed, **mandatory** Instant Buy price — not
  seller-set, not optional, present on every listing:
  `instantBuyPrice = round(basePrice × 1.4, 2)`, computed alongside
  `biddingStartPrice` via `ProductsService.computeInstantBuyPrice`
  (`GET /products/calculate-instant-buy-price` exposes it the same way
  `GET /products/calculate-bidding-price` does).
- `instantBuyPrice` is always strictly above `biddingStartPrice` — the
  markup table above tops out at 1.20× `basePrice`, well under 1.40×.
- Visibility (derived, never stored): `showInstantBuy = currentBid <
  instantBuyPrice`, where `currentBid = currentHighestBid ??
  biddingStartPrice`. Hidden once the current bid meets or exceeds it.
- The actual Instant Buy purchase action, its no-fallback fulfillment
  rule, and its interaction with the bidding state machine are owned by
  **Rule 14: Bidding & Auction Lifecycle** — do not duplicate that logic
  here.

## Required Pre-conditions to Sell
- User must have `isEmailVerified === true` (enforced via login gate).
- User must have `KycStatus === APPROVED` (enforced in service layer).
- User must have bank details on file (`KycService.hasBankDetails`) — bank details are
  optional at KYC submission time, so an approved KYC alone is not sufficient; see Rule 5's
  KYC section for how a user adds bank details after the fact.
- If any fails: throw `ForbiddenException` with a clear message naming the specific
  unmet requirement.

## Item Condition
Defined in `common/enums/item-condition.enum.ts`:

```typescript
enum ItemCondition {
  NEW        = 'NEW',
  LIKE_NEW   = 'LIKE_NEW',
  USED_GOOD  = 'USED_GOOD',
  USED_FAIR  = 'USED_FAIR',
  FOR_PARTS  = 'FOR_PARTS',
}
```

## Images
- Minimum 1 image, maximum 8 images per product.
- JPEG, PNG, WebP only.
- Max 5 MB per image.
- First image (displayOrder: 0) is the primary/thumbnail.
- Stored on local server filesystem under `/uploads/products/:productId/`.
- Served via a protected endpoint — only approved products' images are publicly
  accessible.
- `DRAFT` and `PENDING_REVIEW` product images are only viewable by the owner and
  admins.

## Location
- Out of scope for now.
- Nullable location fields (`locationProvince`, `locationDistrict`, `locationArea`)
  exist on the entity for forward compatibility — leave empty.

## Lifecycle State Machine

### Auction Lifecycle (managed by Rule 14: Bidding & Auction Lifecycle)
```
PENDING → ACTIVE → CLOSED → AWAITING_PAYMENT → SETTLED | PAYMENT_FAILED | ABANDONED
```
All transitions from `PENDING` onward — including the countdown timer, winner
selection, payment window, and fallback chain — are owned by
**Rule 14: Bidding & Auction Lifecycle** and implemented in `BiddingModule`.
Do not add auction-state transition logic to this module.

### Moderation Lifecycle (managed by this module)
```
DRAFT → SUBMITTED → APPROVED → (enters auction as PENDING)
                 ↘ REJECTED
```

### Combined `ProductStatus` Enum
Defined in `common/enums/product-status.enum.ts`:

| Status            | Meaning                                                     |
|-------------------|-------------------------------------------------------------|
| `DRAFT`           | User saved but not submitted for review                     |
| `SUBMITTED`       | Awaiting admin approval                                     |
| `REJECTED`        | Admin rejected — user can edit and resubmit                 |
| `APPROVED`        | Admin approved — transient, auto-transitions to `PENDING`   |
| `PENDING`         | Publicly listed, no bids yet (auction state)                |
| `ACTIVE`          | Bidding started, countdown running (auction state)          |
| `CLOSED`          | Timer ended, no more bids (auction state)                   |
| `AWAITING_PAYMENT`| Winner has 18 hr payment window (auction state)             |
| `SETTLED`         | Sold and paid (auction state)                               |
| `PAYMENT_FAILED`  | Payment window expired (auction state)                      |
| `ABANDONED`       | All fallback bidders exhausted (auction state)              |
| `WITHDRAWN`       | Owner removed before approval or bidding started            |

Current scope handles only: `DRAFT`, `SUBMITTED`, `REJECTED`, `APPROVED`,
`PENDING`, `WITHDRAWN`. All other states exist in the enum but are managed by
the future Bidding module.

### Constants
```typescript
PUBLICLY_VISIBLE_STATUSES = [APPROVED, PENDING, ACTIVE, CLOSED,
                              AWAITING_PAYMENT, SETTLED]
OWNER_EDITABLE_STATUSES   = [DRAFT, REJECTED]
```

## Status Transition Rules (this module's scope)

| Actor  | From              | To          | Trigger                             |
|--------|-------------------|-------------|-------------------------------------|
| Owner  | `DRAFT`           | `SUBMITTED` | POST /products/:id/submit           |
| Owner  | `REJECTED`        | `SUBMITTED` | POST /products/:id/submit           |
| Admin  | `SUBMITTED`       | `PENDING`   | PATCH /admin/products/:id/approve   |
| Admin  | `SUBMITTED`       | `REJECTED`  | PATCH /admin/products/:id/reject    |
| Owner  | `DRAFT`           | `WITHDRAWN` | POST /products/:id/withdraw         |
| Owner  | `SUBMITTED`       | `WITHDRAWN` | POST /products/:id/withdraw         |
| Owner  | `REJECTED`        | `WITHDRAWN` | POST /products/:id/withdraw         |
| Owner  | `APPROVED`        | `WITHDRAWN` | POST /products/:id/withdraw         |
| Owner  | `PENDING`         | `WITHDRAWN` | POST /products/:id/withdraw         |

- `APPROVED` is a transient state: on approval, status is immediately set to
  `PENDING` (publicly listed, awaiting first bid). `APPROVED` is stored briefly
  but resolved to `PENDING` within the same transaction.
- Once a product is `ACTIVE`, `CLOSED`, `AWAITING_PAYMENT`, or `SETTLED`, the
  owner cannot edit, withdraw, or modify it — only admin override (future scope).

## Moderation
- All products require admin approval before becoming publicly visible.
- `DRAFT`, `SUBMITTED`, `REJECTED`, `WITHDRAWN` are visible only to: the owner,
  ADMINs, SUPERADMINs.
- Only `APPROVED`, `PENDING`, `ACTIVE`, `CLOSED`, `AWAITING_PAYMENT`, `SETTLED`
  are publicly visible.

## Public Visibility
- Public list endpoint shows only: `PENDING`, `ACTIVE`, `CLOSED`,
  `AWAITING_PAYMENT`, `SETTLED`.
- Public users (including unauthenticated) can view product detail for
  publicly-visible statuses only — do not leak existence of non-public products.

## Listing Limits
- No cap on number of products per user (current scope).

## Expiry
- Products do not auto-expire (current scope).

## Search & Filters (current scope)
- Filter by:
  - `categoryId`, `subcategoryId`
  - `condition`
  - `keyword` (matches `title` and `description`, case-insensitive)
  - `minPrice` / `maxPrice` — inclusive range, applied against
    `biddingStartPrice` (the buyer-facing entry price, not the seller's
    pre-margin `basePrice`).
- Sort params follow Rule 2 (`?sortBy=...&order=asc|desc`):
  - `sortBy=newest` *(default)* — `createdAt DESC`. `order` ignored.
  - `sortBy=price` — orders by `biddingStartPrice` in the requested `order`
    (default `desc`). Tiebreaker `createdAt DESC` for stable pagination.
  - `sortBy=endingSoon` — soonest-ending first: `biddingEndsAt ASC NULLS LAST`
    (NULLS LAST ensures PENDING products without a started auction do not
    float to the top). `order` is ignored — soonest-ending is always first.

## Detail response metadata

`GET /products/:id` returns the standard product shape plus these detail-only
fields (none appear on list responses, and none are part of the live SSE
`auction.update` payload — that stream stays focused on the bidding battle):

- `topBidders` — up to 5 leaders by highest bid (existing).
- `winningBidder` — **replaces** the raw `winningBidId` on this endpoint only
  (list/admin responses still expose `winningBidId`). The pointer is resolved
  into `{ id, username, winningBid }` — the winning bidder's user id, public
  `username`, and the winning bid amount. `null` until the auction has a winner
  (i.e. no `winningBidId` yet).
- `viewCount` — total recorded detail-page views (see view tracking below).
- `totalBids` — count of all bids on the product.
- `newBidsToday` — count of bids placed **today in Asia/Kathmandu** (UTC+5:45,
  no DST). "Today" is the start of the current Kathmandu calendar day converted
  back to UTC — **not** raw UTC midnight.
- `similarProducts` — up to 5 related products via a **tiered fallback**, each
  stopping as soon as the quota fills:
  1. same `subcategoryId`,
  2. then same `categoryId`,
  3. then random.

  Only biddable products (`PENDING`, `ACTIVE`) are eligible, the current product
  and already-picked ids are excluded, and the result is empty (never an error)
  if nothing matches.

### View tracking (`POST /products/:id/view`)

- Public + throttled (20/min per IP); reads the optional JWT only to apply
  exclusions. Always returns `204 No Content`.
- The increment is **atomic** (`SET "viewCount" = "viewCount" + 1`) — no
  read-modify-write.
- The view is **not** counted when: the viewer is the owner, the viewer is an
  ADMIN/SUPERADMIN, or the product is not in `PUBLICLY_VISIBLE_STATUSES`.
- Tracking is fire-and-forget: failures (including unknown product id) are
  swallowed and never surfaced to the caller.

## Endpoint Access Matrix

| Endpoint                           | Public | USER (own) | USER (other) | ADMIN | SUPERADMIN |
|------------------------------------|--------|------------|--------------|-------|------------|
| GET    /products                   | ✅     | ✅         | ✅           | ✅    | ✅         |
| GET    /products/:id               | ✅*    | ✅         | ✅*          | ✅    | ✅         |
| GET    /products/:id/images/:imgId | ✅*    | ✅         | ✅*          | ✅    | ✅         |
| POST   /products/:id/view          | ✅§    | ✅§        | ✅§          | ✅§   | ✅§        |
| POST   /products                   | ❌     | ✅†        | ❌           | ❌    | ❌         |
| PATCH  /products/:id               | ❌     | ✅‡        | ❌           | ❌    | ❌         |
| POST   /products/:id/submit        | ❌     | ✅‡        | ❌           | ❌    | ❌         |
| POST   /products/:id/withdraw      | ❌     | ✅‡        | ❌           | ❌    | ❌         |
| DELETE /products/:id               | ❌     | ✅‡        | ❌           | ❌    | ❌         |
| GET    /products/me                | ❌     | ✅         | —            | ✅    | ✅         |
| GET    /admin/products             | ❌     | ❌         | ❌           | ✅    | ✅         |
| GET    /admin/products/:id         | ❌     | ❌         | ❌           | ✅    | ✅         |
| PATCH  /admin/products/:id/approve | ❌     | ❌         | ❌           | ✅    | ✅         |
| PATCH  /admin/products/:id/reject  | ❌     | ❌         | ❌           | ✅    | ✅         |

\* Public users only see products in publicly-visible statuses; NotFoundException
  is thrown for others (do not leak existence).
† Requires email verified AND KYC approved.
‡ Only allowed when product status is `DRAFT` or `REJECTED`.
§ Public + throttled (`@Throttle` 20/min per IP). Fire-and-forget: always
  returns `204 No Content`, including the skipped cases (owner/admin viewer,
  non-public status). See **Detail response metadata** below.

## Permissions

Added to `Permission` enum (`common/enums/permission.enum.ts`):

```
PRODUCT_CREATE     = 'product:create'     → USER
PRODUCT_MANAGE_OWN = 'product:manage_own' → USER
PRODUCT_VIEW_OWN   = 'product:view_own'   → USER
PRODUCT_MODERATE   = 'product:moderate'   → ADMIN, SUPERADMIN
PRODUCT_VIEW_ALL   = 'product:view_all'   → ADMIN, SUPERADMIN
```

Role → Permission additions in `auth/role-permissions.map.ts`:
- `USER`       → add `[PRODUCT_CREATE, PRODUCT_MANAGE_OWN, PRODUCT_VIEW_OWN]`
- `ADMIN`      → add `[PRODUCT_MODERATE, PRODUCT_VIEW_ALL]`
- `SUPERADMIN` → already wildcard (all permissions via `Object.values(Permission)`)

## Notification Emails

| Event          | Template file                    | Recipient | Subject                                          |
|----------------|----------------------------------|-----------|--------------------------------------------------|
| Submit         | `product-submitted.template.ts`  | Owner     | "Your product is under review — BidsBazar"       |
| Admin approves | `product-approved.template.ts`   | Owner     | "Your product is now listed — BidsBazar"         |
| Admin rejects  | `product-rejected.template.ts`   | Owner     | "Your product was rejected — Action Required"    |