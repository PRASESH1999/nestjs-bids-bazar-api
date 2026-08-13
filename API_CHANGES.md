# API Change Report

**Base commit compared against:** `80b4a72` — `fix: product view api 500 error` (latest commit on `main`)
**Scope:** all uncommitted working-tree changes as of this report (`git status` / `git diff` against `80b4a72`)
**Generated:** 2026-08-12

> ⚠️ **Important context for whoever reads this**: none of the changes below are committed yet. They span **at least two prior work sessions**, not one:
> 1. A **Fonepay/Payments gateway integration** session — added `PaymentsModule`, `FonepayModule`, SSE payment events, and related permissions/env vars. These files (`src/modules/payments/`, `src/modules/fonepay/`) are entirely untracked in git (never committed), even though they were already running code before this report's changes began.
> 2. An **Instant Buy + Loyalty Points/Seller Tier/Commission** session (this one) — added Instant Buy pricing/purchase flow, a buyer-selected delivery fee, and a full `RewardsModule` (points, seller tier, commission, admin settlement).
>
> Because (1) was never committed, `git diff` cannot show its "before" state — from git's point of view those files simply don't exist yet at `HEAD`. Where that's the case below, they're marked **NEW (untracked)** rather than MODIFIED, with a note on what's actually new user-facing behavior vs. pre-existing-but-uncommitted behavior.

---

## 1. SUMMARY

### What changed and why

| Area | Type | Why |
|---|---|---|
| Instant Buy pricing & visibility | Feature | Every listing now has a fixed buy-now price (`1.4 × basePrice`); hide the option once the current bid reaches it |
| Instant Buy purchase flow | Feature | New no-fallback purchase path that reuses the existing bidding/payment state machine |
| Gateway payment via Fonepay | Feature (pre-existing, uncommitted) | Buyers pay the item price through a Fonepay Intent QR instead of admin-manual confirmation only |
| Buyer-selected delivery fee | Feature | Fixed, two-zone (Inside/Outside Valley), cash-on-delivery fee, snapshotted per payment |
| Buyer/Seller Points, Tier & Commission | Feature | New `RewardsModule`: 1% points on settlement, 5-tier/13-band profit-share commission, admin-driven settlement flow |
| `GET /bids/:id/bids` permission fix | Bugfix (pre-existing, uncommitted) | Admins previously couldn't hit this endpoint under their own permission set |
| `typeorm.config.ts` entities list | Chore/fix | Was stale (only 3 of 14 entities registered) — `migration:generate` would have silently ignored most tables |
| `products.repository.ts` type tightening | Chore | Lint auto-fix; no behavioral or API change |

### Files touched, grouped by module

**Products** (`src/modules/products/`)
- `entities/product.entity.ts` — MODIFIED (new column)
- `products.service.ts` — MODIFIED
- `products.controller.ts` — MODIFIED (new endpoint)
- `products.repository.ts` — MODIFIED (cosmetic only, no API impact)

**Bidding** (`src/modules/bidding/`)
- `entities/bid.entity.ts` — MODIFIED (new column)
- `bidding.controller.ts` — MODIFIED (new endpoint, one endpoint's request body changed, one permission fix)
- `bidding.module.ts` — MODIFIED (wiring only)
- `services/auction-lifecycle.service.ts` — MODIFIED (new method, one existing method's fallback logic changed, one existing method's signature changed)
- `services/auction-broadcast.service.ts` — MODIFIED (SSE payload shape changed, new event type multiplexed onto the same stream)
- `dto/confirm-payment-manual.dto.ts` — NEW

**Payments** (`src/modules/payments/`) — entire module is **NEW (untracked)** relative to git; only the `initiate` endpoint's contract changed within *this* session
- `payments.controller.ts`, `services/payments.service.ts`, `dto/payment.dto.ts`, `entities/payment.entity.ts` — NEW (untracked) module; `dto/payment.dto.ts` and `entities/payment.entity.ts` and `initiatePayment()` were further modified this session (delivery zone/charge, seller-settlement columns)

**Fonepay** (`src/modules/fonepay/`) — entire module is NEW (untracked), unchanged this session

**Rewards** (`src/modules/rewards/`) — entirely NEW this session
- `entities/user-rewards.entity.ts`, `entities/points-transaction.entity.ts`
- `rewards.service.ts`, `rewards.module.ts`, `admin-rewards.controller.ts`
- `dto/adjust-points.dto.ts`

**Users** (`src/modules/users/`)
- `interfaces/own-profile.interface.ts` — MODIFIED (new field)
- `users.service.ts` — MODIFIED (`GET /users/me` response body)
- `users.module.ts` — MODIFIED (wiring only)

**Shared/config**
- `src/common/enums/permission.enum.ts`, `src/modules/auth/role-permissions.map.ts` — new permissions
- `src/common/events/event-names.ts`, `event-payloads.type.ts` — new domain events
- `src/common/enums/delivery-zone.enum.ts`, `seller-tier.enum.ts`, `points-transaction-type.enum.ts`, `payment-status.enum.ts` — new/untracked enums
- `.env.example`, `src/config/env.validation.ts` — new required env vars
- `src/config/typeorm.config.ts` — fixed stale entities array
- `src/app.module.ts` — registered `PaymentsModule`, `FonepayModule`, `RewardsModule`

---

## 2. ENDPOINT-BY-ENDPOINT BREAKDOWN

### `GET /api/v1/products` (list) and `GET /api/v1/products/:id` (detail), plus every other product-returning endpoint (`/products/me`, `/products/:id/submit`, `/products/:id/withdraw`, `POST/PATCH /products`, `/admin/products`, `/admin/products/:id`)

**Status:** MODIFIED (additive — response shape only)

All of these funnel through the single private mapper `ProductsService.mapProduct()`, so the same two new fields appear on **every** product object returned anywhere in the API.

**OLD response (product object, abbreviated):**
```json
{
  "id": "uuid",
  "title": "iPhone 13",
  "basePrice": 100000,
  "biddingStartPrice": 112000,
  "currency": "NPR",
  "currentHighestBid": null,
  "status": "PENDING",
  "...": "..."
}
```

**NEW response:**
```json
{
  "id": "uuid",
  "title": "iPhone 13",
  "basePrice": 100000,
  "biddingStartPrice": 112000,
  "instantBuyPrice": 140000,
  "showInstantBuy": true,
  "currency": "NPR",
  "currentHighestBid": null,
  "status": "PENDING",
  "...": "..."
}
```

**What changed:** two new fields added — `instantBuyPrice` (decimal, always `1.4 × basePrice`) and `showInstantBuy` (boolean, derived: `currentBid < instantBuyPrice`, hidden once the current bid meets or exceeds it).

**Breaking?** **NO** for JSON-tolerant clients. **Potentially YES** for strictly-typed frontend clients (e.g., TypeScript interfaces with `exactOptionalPropertyTypes`, or any request validators/mocks asserting an exact response shape) — those need their Product type updated to include the two new fields or they'll fail type checks even though the wire format is backward-compatible.

---

### `GET /api/v1/products/calculate-instant-buy-price`

**Status:** NEW

Mirrors the pre-existing `GET /products/calculate-bidding-price`.

**Sample request:**
```
GET /api/v1/products/calculate-instant-buy-price?basePrice=100000
```

**Sample response:**
```json
{
  "basePrice": 100000,
  "instantBuyPrice": 140000
}
```

**Auth:** `@Public()` — no auth required, same as its bidding-price sibling.

**Errors:** `400 Bad Request` if `basePrice` is missing, non-numeric, or `<= 0` — `{"message": "basePrice must be a positive number", "statusCode": 400}`.

---

### `POST /api/v1/products/:id/instant-buy`

**Status:** NEW

**Sample request:**
```
POST /api/v1/products/3fa85f64-5717-4562-b3fc-2c963f66afa6/instant-buy
Authorization: Bearer <jwt>
```
(no body)

**Sample response** (a `Product` object, `status: "AWAITING_PAYMENT"`):
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "iPhone 13",
  "status": "AWAITING_PAYMENT",
  "basePrice": 100000,
  "biddingStartPrice": 112000,
  "instantBuyPrice": 140000,
  "showInstantBuy": false,
  "currentHighestBid": 140000,
  "currentHighestBidderId": "buyer-uuid",
  "winningBidId": "new-bid-uuid",
  "closedAt": "2026-08-12T10:00:00.000Z",
  "...": "..."
}
```

**Auth:** JWT required, `Permission.BID_PLACE` (same permission as placing a normal bid — `USER` role).

**Errors:**
- `400 Bad Request` — product not `PENDING`/`ACTIVE`, caller is the owner, or `showInstantBuy` is no longer true (someone else's bid already crossed the threshold)
- `500 Internal Server Error` — data-consistency guard if a payment-responsible bid already exists (should never happen in practice)

**Behavioral note for frontend/QA:** once this succeeds, the auction is over — **no other bidder can ever win this product**, even if the Instant Buy buyer never pays. There is no polling/retry path that reassigns the win. This is intentionally different from a normal auction timeout (which falls back to the next-highest bidder).

---

### `POST /api/v1/products/:id/bids` (normal bid placement)

**Status:** UNCHANGED endpoint/contract, but **its response object gains a field** (see Bid schema note below).

---

### Bid objects returned by `GET /products/:id/bids`, `GET /bids/me`, `GET /admin/products/:id/bids`, `GET /admin/bids`

**Status:** MODIFIED (additive)

**OLD bid object (abbreviated):**
```json
{
  "id": "bid-uuid",
  "productId": "product-uuid",
  "bidderId": "user-uuid",
  "amount": 115000,
  "isCurrentlyPaymentResponsible": true,
  "paymentStatus": "PENDING",
  "paymentConfirmationMethod": null
}
```

**NEW bid object:**
```json
{
  "id": "bid-uuid",
  "productId": "product-uuid",
  "bidderId": "user-uuid",
  "amount": 115000,
  "isCurrentlyPaymentResponsible": true,
  "isInstantBuy": false,
  "paymentStatus": "PENDING",
  "paymentConfirmationMethod": null
}
```

**What changed:** new `isInstantBuy: boolean` field. Also, `paymentConfirmationMethod` can now take the value `"BANK_API"` in addition to `"ADMIN_MANUAL"` — a value the frontend may not have been handling if it special-cased confirmation methods.

**Breaking?** NO (additive field + additive enum value), but frontend code that does an exhaustive switch/if-chain on `paymentConfirmationMethod` values should add a `BANK_API` branch or it'll silently fall through to a default case.

---

### `GET /api/v1/products/:id/bids`

**Status:** MODIFIED — **permission requirement changed** (this looks like a bugfix from the pre-existing uncommitted work, not something added this session, but it's a real behavior change against the last commit)

**Before:**
```ts
@RequirePermissions(Permission.BID_VIEW_OWN)
```

**After:**
```ts
@RequirePermissions(Permission.BID_VIEW_OWN, Permission.BID_VIEW_ALL)
```

**What changed:** the guard now accepts **either** permission (any-of match, per `PermissionsGuard`'s existing semantics). Previously, a caller holding only `BID_VIEW_ALL` (i.e., an ADMIN who does **not** also have `BID_VIEW_OWN`) would have been rejected with `403 Forbidden` — that's very likely what this fixes, since `RolePermissionsMap[Role.ADMIN]` only grants `BID_VIEW_ALL`, not `BID_VIEW_OWN`.

**Breaking?** NO — this is strictly more permissive than before (a bugfix loosening an over-restrictive guard). No previously-working caller loses access.

---

### `GET /api/v1/products/:id/events` (SSE stream)

**Status:** MODIFIED

**OLD `auction.update` event payload:**
```json
{
  "type": "auction.update",
  "productId": "uuid",
  "status": "ACTIVE",
  "currentHighestBid": 115000,
  "currentHighestBidderId": "user-uuid",
  "biddingEndsAt": "2026-08-13T10:00:00.000Z",
  "topBidders": [{ "username": "alice", "highestBid": 115000 }],
  "recentBids": [{ "username": "alice", "amount": 115000, "placedAt": "..." }]
}
```

**NEW `auction.update` event payload:**
```json
{
  "type": "auction.update",
  "productId": "uuid",
  "status": "ACTIVE",
  "currentHighestBid": 115000,
  "currentHighestBidderId": "user-uuid",
  "biddingEndsAt": "2026-08-13T10:00:00.000Z",
  "instantBuyPrice": 140000,
  "showInstantBuy": true,
  "topBidders": [{ "username": "alice", "highestBid": 115000 }],
  "recentBids": [{ "username": "alice", "amount": 115000, "placedAt": "..." }]
}
```

**Also new:** the same SSE stream can now emit **four additional event types**, discriminated by `type`, pushed directly (not derived from `buildPayload`):
```json
{ "type": "payment.initiated", "productId": "uuid", "paymentId": "...", "referenceLabel": "...", "winnerUserId": "..." }
{ "type": "payment.succeeded", "productId": "uuid", "paymentId": "...", "amount": 115000, "fonepayTraceId": "..." }
{ "type": "payment.failed", "productId": "uuid", "paymentId": "...", "message": "..." }
{ "type": "win.transferred", "productId": "uuid", "fromUserId": "...", "toUserId": "...", "newPaymentDeadline": "..." }
```

**What changed:** (1) `instantBuyPrice`/`showInstantBuy` added to every `auction.update` snapshot; (2) the stream is no longer single-purpose — frontend SSE handlers **must** switch on `event.type` now if they don't already, since non-`auction.update` events can arrive on the same connection.

**Breaking?** Field addition is non-breaking. The new event types on the same stream **are potentially breaking** for any frontend SSE consumer that assumed every message was an `auction.update` shape and accessed fields without checking `type` first — it would now occasionally receive a differently-shaped object.

---

### `POST /api/v1/admin/products/:id/confirm-payment`

**Status:** MODIFIED — **request body changed from none to required**

**OLD request:**
```
POST /api/v1/admin/products/:id/confirm-payment
Authorization: Bearer <admin-jwt>
```
*(no body)*

**NEW request:**
```
POST /api/v1/admin/products/:id/confirm-payment
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "deliveryZone": "INSIDE_VALLEY"
}
```

**Validation:** `deliveryZone` is required and must be one of `"INSIDE_VALLEY" | "OUTSIDE_VALLEY"` (`@IsEnum(DeliveryZone)`). Missing or invalid value → `400 Bad Request` with a class-validator error array.

**Response:** unchanged shape (`Product` object), but as a side effect this endpoint now **also creates a `Payment` record** behind the scenes (status `SUCCESS`, `terminalId: "ADMIN-MANUAL"`) so the sale can flow through the new seller-settlement pipeline (see Rewards section below).

**Breaking?** **YES.** Any existing admin-tool integration calling this endpoint with an empty body will now get a `400` where it previously got a `200`. This is the single most important breaking change for whoever built the admin panel against the old contract.

---

### `POST /api/v1/payments/:productId/initiate`

**Status:** MODIFIED (this endpoint itself is new-to-git/untracked as a whole, but its contract changed again within this session, so documenting the delta is meaningful for QA/frontend regardless of git history)

**OLD request** (before this session's change):
```
POST /api/v1/payments/:productId/initiate
Authorization: Bearer <jwt>
```
*(no body — `initiatePayment(productId, userId)`)*

**NEW request:**
```
POST /api/v1/payments/:productId/initiate
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "deliveryZone": "OUTSIDE_VALLEY"
}
```

**Validation:** `deliveryZone` required, `@IsEnum(DeliveryZone)`.

**Response — unchanged shape:**
```json
{
  "paymentId": "uuid",
  "referenceLabel": "ABC123...",
  "amount": 140000,
  "qrString": "...",
  "qrMessage": "...",
  "status": "PENDING",
  "paymentDeadline": "2026-08-13T04:00:00.000Z"
}
```
(`deliveryCharge` is computed and stored on the `Payment` row server-side but is **not** currently echoed back in this response DTO — see Frontend Integration Checklist, item 3.)

**Breaking?** **YES.** A request without `deliveryZone` now fails validation with `400 Bad Request` where it previously succeeded.

---

### `GET /api/v1/users/me`

**Status:** MODIFIED (additive)

**OLD response (abbreviated):**
```json
{
  "id": "uuid",
  "name": "Alice",
  "username": "alice",
  "email": "alice@example.com",
  "role": "USER",
  "kyc": { "status": "APPROVED", "...": "..." },
  "pendingEmailChange": null
}
```

**NEW response:**
```json
{
  "id": "uuid",
  "name": "Alice",
  "username": "alice",
  "email": "alice@example.com",
  "role": "USER",
  "kyc": { "status": "APPROVED", "...": "..." },
  "pendingEmailChange": null,
  "rewards": {
    "buyerPoints": 0,
    "sellerPoints": 0,
    "sellerTier": "BRONZE"
  }
}
```

**What changed:** new `rewards` object. Defaults to `{0, 0, "BRONZE"}` for a user who has never had a `UserRewards` row created (i.e., everyone, until the first settlement they're party to).

**Breaking?** NO — additive field only.

---

## 3. NEW ENDPOINTS (full list)

| # | Method & Path | Purpose | Auth |
|---|---|---|---|
| 1 | `GET /api/v1/products/calculate-instant-buy-price` | Preview `instantBuyPrice` for a given `basePrice` | Public |
| 2 | `POST /api/v1/products/:id/instant-buy` | Immediately buy at `instantBuyPrice`, closing the auction, no fallback | JWT, `bid:place` |
| 3 | `GET /api/v1/admin/payments/pending-settlement` | List settled sales awaiting seller payout | JWT, `settlement:manage` (ADMIN/SUPERADMIN) |
| 4 | `POST /api/v1/admin/payments/:id/mark-seller-paid` | Flag a sale as paid to the seller — the sole points/commission trigger | JWT, `settlement:manage` (ADMIN/SUPERADMIN) |
| 5 | `POST /api/v1/admin/users/:userId/points/adjust` | Manually credit/debit a user's buyer or seller points | JWT, `points:adjust` (ADMIN/SUPERADMIN) |

*(Not counted as "new" for this feature since they predate this session, even though untracked in git: `GET /api/v1/payments/:productId/banks`, `POST /api/v1/payments/:productId/initiate`, `GET /api/v1/payments/:productId/status`.)*

### #2 — `POST /products/:id/instant-buy`
See full detail in §2 above.

### #3 — `GET /admin/payments/pending-settlement`

**Sample request:**
```
GET /api/v1/admin/payments/pending-settlement
Authorization: Bearer <admin-jwt>
```

**Sample response:**
```json
[
  {
    "id": "payment-uuid",
    "productId": "product-uuid",
    "winnerUserId": "buyer-uuid",
    "amount": 140000,
    "status": "SUCCESS",
    "deliveryZone": "INSIDE_VALLEY",
    "deliveryCharge": 100,
    "sellerPaidAt": null,
    "sellerPaidById": null,
    "sellerPayoutAmount": null,
    "sellerCommissionPercent": null,
    "createdAt": "2026-08-12T09:00:00.000Z"
  }
]
```

### #4 — `POST /admin/payments/:id/mark-seller-paid`

**Sample request:**
```
POST /api/v1/admin/payments/payment-uuid/mark-seller-paid
Authorization: Bearer <admin-jwt>
```
*(no body)*

**Sample response** (the updated `Payment` row):
```json
{
  "id": "payment-uuid",
  "productId": "product-uuid",
  "winnerUserId": "buyer-uuid",
  "amount": 140000,
  "status": "SUCCESS",
  "sellerPaidAt": "2026-08-12T11:00:00.000Z",
  "sellerPaidById": "admin-uuid",
  "sellerPayoutAmount": 108000,
  "sellerCommissionPercent": 20,
  "...": "..."
}
```

**Errors:**
- `404 Not Found` — payment doesn't exist
- `400 Bad Request` — payment `status !== 'SUCCESS'` (buyer hasn't actually paid yet)
- `409 Conflict` — already marked paid (idempotency guard)

**Side effects (not visible in the response, verify via `GET /users/me` on both accounts):** buyer and seller each receive `round(0.01 × amount)` points; seller's `sellerTier` may change; two `PointsTransaction` ledger rows are written.

### #5 — `POST /admin/users/:userId/points/adjust`

**Sample request:**
```
POST /api/v1/admin/users/user-uuid/points/adjust
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "type": "SELLER",
  "delta": -50,
  "reason": "Correcting a duplicate award from payment abc123"
}
```

**Sample response:**
```json
{
  "id": "user-rewards-uuid",
  "userId": "user-uuid",
  "buyerPoints": 120,
  "sellerPoints": 450,
  "sellerTier": "BRONZE"
}
```

**Validation:** `type` ∈ `{BUYER, SELLER}`, `delta` integer (positive or negative), `reason` required non-empty string.

---

## 4. DEPRECATED / REMOVED ENDPOINTS

**None.** No endpoints were removed or deprecated in this diff. `confirmPaymentManual` (admin-manual confirmation) is explicitly **retained** as a long-term fallback mechanism alongside the new gateway-payment path — see Rule 14 in the updated docs.

---

## 5. FRONTEND INTEGRATION CHECKLIST

1. **Product type/interface** — add `instantBuyPrice: number` and `showInstantBuy: boolean` to whatever TypeScript type models a product, wherever product data is consumed (listing pages, product detail page, "my listings," admin product views, search results).
2. **Product detail page** — render an "Instant Buy" button/CTA gated on `showInstantBuy`, wired to `POST /products/:id/instant-buy`. On success, immediately stop showing the bidding UI for that product (it's now `AWAITING_PAYMENT`) and redirect into the existing payment/checkout flow.
3. **Checkout / payment initiation UI** — add a **delivery zone selector** (Inside Valley / Outside Valley) to whatever screen calls `POST /payments/:productId/initiate`, and pass it in the request body. This call will now **fail with 400** if the field is omitted — this is the most likely thing to silently break in a frontend that hasn't been updated. Consider also displaying the delivery charge to the buyer before submission — note the current API does **not** echo `deliveryCharge` back in `InitiatePaymentResponseDto`, so the frontend will need to either hardcode the two known amounts or a follow-up backend change should add it to the response (flagged below).
4. **Admin confirm-payment screen** — the admin-manual confirm-payment action now requires a delivery zone selection in its request body too. Update that admin UI form.
5. **SSE consumer** (`EventSource` on `/products/:id/events`) — if the frontend doesn't already switch on `event.type`, add that now: it may receive `payment.initiated` / `payment.succeeded` / `payment.failed` / `win.transferred` events interleaved with `auction.update`. Also read the new `instantBuyPrice`/`showInstantBuy` fields from `auction.update` to keep the Instant Buy button in sync live (it should disappear the instant someone else's bid crosses the threshold).
6. **Bid list rendering** (bid history, "my bids," admin bid views) — handle the new `isInstantBuy` flag if you want to visually distinguish an Instant Buy win from a normal auction win. Also handle `paymentConfirmationMethod === "BANK_API"` if that field is surfaced/branched on anywhere.
7. **User profile screen** (`GET /users/me`) — add UI for the new `rewards: { buyerPoints, sellerPoints, sellerTier }` block. Decide whether/how to surface seller tier badges elsewhere (product cards, seller profile) — not required by the API but a natural consumer of this new field.
8. **New admin screens needed** (none of these existed before):
   - Pending seller settlements list (`GET /admin/payments/pending-settlement`) with a "mark as paid" action per row (`POST /admin/payments/:id/mark-seller-paid`).
   - A manual points-adjustment form (`POST /admin/users/:userId/points/adjust`) — user picker, buyer/seller radio, delta input, required reason text field.
9. **Auth/permissions** — if the frontend maintains a client-side permission map mirroring the backend's `Permission` enum (e.g., to conditionally render admin nav items), add `settlement:manage` and `points:adjust`, both granted to ADMIN/SUPERADMIN.
10. **No new headers or token types** — all new endpoints use the existing `Authorization: Bearer <jwt>` + role/permission model. No new environment variables are needed on the **frontend** side as a result of this change (the new `DELIVERY_CHARGE_*`/`FONEPAY_*` env vars are backend-only).

---

## 6. TESTING NOTES

### Instant Buy pricing preview
```bash
curl "http://localhost:3000/api/v1/products/calculate-instant-buy-price?basePrice=100000"
# => {"basePrice":100000,"instantBuyPrice":140000}

curl "http://localhost:3000/api/v1/products/calculate-instant-buy-price?basePrice=-5"
# => 400 {"message":"basePrice must be a positive number", ...}
```

### Instant Buy purchase — happy path
```bash
curl -X POST "http://localhost:3000/api/v1/products/$PRODUCT_ID/instant-buy" \
  -H "Authorization: Bearer $USER_JWT"
```
**Verify:**
- Response `status` is `AWAITING_PAYMENT`, `currentHighestBid` equals `instantBuyPrice`.
- Re-fetch `GET /products/:id` — `showInstantBuy` is now `false` and `status` is `AWAITING_PAYMENT`.
- A second call to `instant-buy` on the same product (by anyone) → `400 Bad Request`.

### Instant Buy — edge cases to specifically re-test
- **Boundary**: place normal bids until `currentHighestBid === instantBuyPrice` exactly, then confirm `showInstantBuy` flips to `false` and the instant-buy endpoint now rejects with `400` (the `=` case is easy to get backwards — confirm it's excluded, not included).
- **Owner attempting instant-buy on own product** → `400`.
- **Non-payment**: call `instant-buy`, then let `PAYMENT_WINDOW_HOURS` elapse without paying. Confirm the product goes to `ABANDONED` — **not** reassigned to any other bidder, even if lower bids exist on the product.
- **Race**: fire a normal bid and an instant-buy call for the same product at nearly the same time; confirm exactly one of them wins (no double-settlement, no corrupted `isCurrentlyPaymentResponsible` state).

### Delivery zone on payment initiation
```bash
curl -X POST "http://localhost:3000/api/v1/payments/$PRODUCT_ID/initiate" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{"deliveryZone":"INSIDE_VALLEY"}'
# => 200, InitiatePaymentResponseDto

curl -X POST "http://localhost:3000/api/v1/payments/$PRODUCT_ID/initiate" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{}'
# => 400 — deliveryZone is required (regression check: this used to succeed)

curl -X POST "http://localhost:3000/api/v1/payments/$PRODUCT_ID/initiate" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{"deliveryZone":"MARS"}'
# => 400 — must be INSIDE_VALLEY or OUTSIDE_VALLEY
```

### Admin manual confirm-payment (now requires a body)
```bash
curl -X POST "http://localhost:3000/api/v1/admin/products/$PRODUCT_ID/confirm-payment" \
  -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"deliveryZone":"OUTSIDE_VALLEY"}'
# => 200, Product now SETTLED

curl -X POST "http://localhost:3000/api/v1/admin/products/$PRODUCT_ID/confirm-payment" \
  -H "Authorization: Bearer $ADMIN_JWT"
# => 400 — regression check: an empty body used to work, now must fail
```

### Rewards / settlement flow (end-to-end)
```bash
# 1. List what's pending
curl "http://localhost:3000/api/v1/admin/payments/pending-settlement" \
  -H "Authorization: Bearer $ADMIN_JWT"

# 2. Mark one as paid
curl -X POST "http://localhost:3000/api/v1/admin/payments/$PAYMENT_ID/mark-seller-paid" \
  -H "Authorization: Bearer $ADMIN_JWT"

# 3. Re-run the same call — must now 409, not 200 again (idempotency)
curl -X POST "http://localhost:3000/api/v1/admin/payments/$PAYMENT_ID/mark-seller-paid" \
  -H "Authorization: Bearer $ADMIN_JWT"
# => 409 Conflict

# 4. Confirm both parties' points updated
curl "http://localhost:3000/api/v1/users/me" -H "Authorization: Bearer $BUYER_JWT"
curl "http://localhost:3000/api/v1/users/me" -H "Authorization: Bearer $SELLER_JWT"
```
**Worked-example check** (reproduce exactly): a product with `basePrice=100`, sold for `150`, seller at 0 pre-existing points (Bronze/20%) → `sellerPayoutAmount` must equal `110` (`100 + 20% × (150 − 100)`).

### Points adjustment
```bash
curl -X POST "http://localhost:3000/api/v1/admin/users/$USER_ID/points/adjust" \
  -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"type":"SELLER","delta":-50,"reason":"test correction"}'
```
**Verify:** `sellerTier` on the response reflects the new `sellerPoints` total (test crossing a band boundary, e.g. debit from 1550 → 1450 should drop `SILVER` back to `BRONZE`). Also verify a `BUYER`-type adjustment **never** changes `sellerTier` — this is a hard invariant worth a dedicated regression check.

### Permission/auth checks
```bash
# Non-admin hitting rewards admin endpoints must 403
curl "http://localhost:3000/api/v1/admin/payments/pending-settlement" -H "Authorization: Bearer $USER_JWT"
# => 403

# GET /products/:id/bids as ADMIN (regression for the permission fix)
curl "http://localhost:3000/api/v1/products/$PRODUCT_ID/bids" -H "Authorization: Bearer $ADMIN_JWT"
# => 200 (previously would have 403'd under the old single-permission guard)
```

### Known gaps to flag to QA (not yet resolved)
- `InitiatePaymentResponseDto` does not currently return `deliveryCharge` — frontend cannot display it without a hardcoded lookup or a backend follow-up.
- No automated test yet covers the `executeInstantBuy` / `handlePaymentExpiry` no-fallback transactional path end-to-end (only pure pricing/commission logic has unit tests as of this report) — manual QA on the "Instant Buy — edge cases" section above is the only current coverage.
