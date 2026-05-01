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
- Platform applies a 10% margin: bidding starts at `basePrice * 1.10`.
- Both values are stored on the product:
    `basePrice`          : user-entered desired price
    `biddingStartPrice`  : auto-computed = `basePrice * 1.10`
- First bid must be ≥ `biddingStartPrice`.
- Bidding logic, countdown, and increments are governed by Rule 3: Bidding Domain
  Logic — do NOT duplicate that logic here.

## Required Pre-conditions to Sell
- User must have `isEmailVerified === true` (enforced via login gate).
- User must have `KycStatus === APPROVED` (enforced in service layer).
- If either fails: throw `ForbiddenException` with a clear message.

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

### Auction Lifecycle (managed by future Bidding module)
```
PENDING → ACTIVE → CLOSED → AWAITING_PAYMENT → SETTLED | PAYMENT_FAILED | ABANDONED
```

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
- Filter by: `categoryId`, `subcategoryId`, `condition`, `keyword` (matches
  `title` and `description`, case-insensitive).
- Sort by: newest first (`createdAt DESC`) — default and only option.

## Endpoint Access Matrix

| Endpoint                           | Public | USER (own) | USER (other) | ADMIN | SUPERADMIN |
|------------------------------------|--------|------------|--------------|-------|------------|
| GET    /products                   | ✅     | ✅         | ✅           | ✅    | ✅         |
| GET    /products/:id               | ✅*    | ✅         | ✅*          | ✅    | ✅         |
| GET    /products/:id/images/:imgId | ✅*    | ✅         | ✅*          | ✅    | ✅         |
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