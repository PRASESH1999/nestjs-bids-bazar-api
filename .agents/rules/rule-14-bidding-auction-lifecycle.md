---
trigger: always_on
---

# Rule 14: Bidding & Auction Lifecycle

## Definition
- A bid is an offer placed by an authenticated, email-verified USER on a publicly-visible product.
- Bids progress an auction from `PENDING` → `ACTIVE`; the countdown timer is created by the first bid.
- One auction = one product = one winning bid (with a sequential fallback chain on payment failure).
- All bidding and auction-state logic lives exclusively in `BiddingModule`
  (`src/modules/bidding/`) — never in `ProductsModule` or any other module.

## Pre-conditions to Bid
- User must be authenticated (verified email — enforced by the login gate; no extra guard needed here).
- User must NOT be the product owner.
- Product must be in `PENDING` or `ACTIVE` status.
- Product status must be re-validated INSIDE the bid transaction to defend against race conditions.

## Pricing & Increment Rules

### First bid (product status: `PENDING`)
- Amount must be ≥ `product.biddingStartPrice` (no upper cap on the first bid).
- On success:
    - Transitions product → `ACTIVE`
    - Sets `product.biddingStartedAt = now`
    - Sets `product.biddingEndsAt = now + BIDDING_DURATION_HOURS`

### Subsequent bids (product status: `ACTIVE`)
- Let `current` = `product.currentHighestBid`
- Let `percentInc` = `current × BID_INCREMENT_PERCENT`
- Let `minInc` = `max(BID_INCREMENT_MIN_FLAT, percentInc)`
- Let `maxInc` = `percentInc`
- If `minInc > maxInc` (low-price edge case where the flat floor exceeds the percentage):
    - Only `current + BID_INCREMENT_MIN_FLAT` is accepted
- Otherwise:
    - `current + minInc ≤ amount ≤ current + maxInc`
- All amounts are NPR, rounded to 2 decimal places.
- Use a decimal arithmetic library (e.g. `decimal.js`) — never JS floats for money.

### Self-outbid
- A user whose bid is currently the highest may NOT place another bid until someone else
  outbids them. Return `403 ForbiddenException`.

## Auction Lifecycle State Machine

```
PENDING ──first bid──► ACTIVE ──timer expires──► CLOSED
                                                      │
                                            (pick highest bid)
                                                      ▼
                                            AWAITING_PAYMENT
                                              │            │
                                  (paid in time)     (window expired)
                                              │            │
                                              ▼            ▼
                                          SETTLED   ──────────────►
                                                    (next bidder exists?)
                                                    ┌──────────────┐
                                                    ▼              ▼
                                            AWAITING_PAYMENT   ABANDONED
                                            (next bidder)
```

Note: The `CLOSED` status is a transient audit state — the product moves directly to
`AWAITING_PAYMENT` inside the same transaction as the close.

## Closing Logic

Two paths trigger auction close — both call the same idempotent method:

```
AuctionLifecycleService.closeIfExpired(productId)
```

- **Path 1 (Phase 2)**: Cron job runs every 1 minute.
- **Path 2 (Phase 2)**: Lazy closure check inside `GET /products/:id` and `POST /products/:id/bids`.

### `closeIfExpired` must:
- Open a transaction with `SELECT FOR UPDATE` on the product row.
- Re-check `status` and `biddingEndsAt` INSIDE the transaction.
- If conditions are still met: pick the highest-amount bid as winner (tiebreaker: earliest
  `placedAt`), transition product to `AWAITING_PAYMENT`, set the winning bid's
  `paymentDeadline = now + PAYMENT_WINDOW_HOURS` and `isCurrentlyPaymentResponsible = true`.
- Notify winner and seller (Phase 3).
- **Idempotent**: if status is already past `ACTIVE`, return without changes.

## Payment Window & Fallback Chain

When a bid is the currently-responsible bid:
- `paymentStatus = PENDING`
- `paymentDeadline = closedAt + PAYMENT_WINDOW_HOURS`
- `isCurrentlyPaymentResponsible = true` (only ONE bid per product may have this `true` —
  enforced by a partial unique index)

### Payment expiry

Two paths trigger payment-window expiry — same dual pattern as closing (Phase 2 implements both).

`AuctionLifecycleService.handlePaymentExpiry(productId)`:
- Transactional + row-locked.
- Mark the current responsible bid as `paymentStatus = EXPIRED`,
  `isCurrentlyPaymentResponsible = false`.
- Find the next bid: `paymentStatus = NOT_RESPONSIBLE AND id != current.id ORDER BY amount DESC LIMIT 1`.
- If found: assign `fallbackRank = current.fallbackRank + 1`, set it as the new responsible
  bid with a fresh payment deadline.
- If no more bids: product transitions to `ABANDONED`.
- Product remains in `AWAITING_PAYMENT` during fallback — only the responsible bid changes.

## Payment Confirmation

- An admin-only endpoint `POST /admin/products/:productId/confirm-payment` (implemented in
  Phase 2) calls `AuctionLifecycleService.confirmPaymentManual(adminId, productId)`.
- This endpoint is kept long-term as a backup mechanism even after bank API integration,
  for cases where the API fails or admin intervention is needed.
- On confirmation:
    - Responsible bid: `paymentStatus = CONFIRMED`, `paymentConfirmedAt`, `paymentConfirmedById`,
      `paymentConfirmationMethod = ADMIN_MANUAL`.
    - Product: `status = SETTLED`, `settledAt = now`.
    - All other bids on this product: `paymentStatus = NOT_RESPONSIBLE` (clean final state).
    - Notify seller and buyer (Phase 3).

## Concurrency Rules
- All bid placement, closure, and fallback operations must run inside a database transaction.
- All such operations must use `SELECT FOR UPDATE` on the product row before any read that
  informs a write.
- All status checks happen INSIDE the transaction — never before opening it.
- Every state-transition method is idempotent: calling it on a product already in the target
  state is a safe no-op.

## Bid History Visibility (3-tier)

| Viewer                         | Endpoint                        | Data exposed                                      |
|--------------------------------|---------------------------------|---------------------------------------------------|
| Public (unauthenticated)       | `GET /products/:id`             | `currentHighestBid` only (no bid history)         |
| Public (unauthenticated)       | `GET /products/:id/bids`        | 401 Unauthorized                                  |
| Authenticated USER (any role)  | `GET /products/:id/bids`        | Full history — amounts, timestamps, bidder names  |
| ADMIN / SUPERADMIN             | `GET /admin/products/:id/bids`  | Full history + emails, paymentStatus, metadata    |

- "Current highest bid" for unauthenticated users is served via `GET /products/:id` in
  `ProductsService` — NOT via the bids endpoints.
- Sellers viewing their own product's bids see the authenticated-USER view (names, no emails).
- Bidder emails are NEVER returned in the authenticated-USER view.

## Restrictions
- **Self-outbid**: not allowed — return `403 ForbiddenException`.
- **Bid retraction**: not supported — bids are immutable once placed.
- **Seller-on-own-product**: not allowed — return `403 ForbiddenException`.
- **Suspended owner**: bidding on a product whose owner is suspended is not allowed.

## Endpoint Access Matrix

| Endpoint                                   | Public | USER | ADMIN | SUPERADMIN |
|--------------------------------------------|--------|------|-------|------------|
| POST   /products/:id/bids                  | ❌     | ✅   | ❌    | ❌         |
| GET    /products/:id/bids                  | ❌     | ✅†  | ✅†   | ✅†        |
| GET    /bids/me                            | ❌     | ✅   | ❌    | ❌         |
| GET    /admin/products/:id/bids            | ❌     | ❌   | ✅‡   | ✅‡        |
| POST   /admin/products/:id/confirm-payment | ❌     | ❌   | ✅    | ✅         |

† Full history with bidder names and timestamps (no emails).
‡ Full history with bidder emails and admin-only metadata.

Public viewing of "current highest bid" is via `GET /products/:id` (ProductsService) — not bids endpoints.

## Permissions

Added to `Permission` enum (`common/enums/permission.enum.ts`):

```
BID_PLACE              = 'bid:place'              → USER
BID_VIEW_OWN           = 'bid:view_own'           → USER
BID_VIEW_ALL           = 'bid:view_all'           → ADMIN, SUPERADMIN
PAYMENT_CONFIRM_MANUAL = 'payment:confirm_manual' → ADMIN, SUPERADMIN
```

Role → Permission additions in `auth/role-permissions.map.ts`:
- `USER`       → add `[BID_PLACE, BID_VIEW_OWN]`
- `ADMIN`      → add `[BID_VIEW_ALL, PAYMENT_CONFIRM_MANUAL]`
- `SUPERADMIN` → already wildcard (all permissions via `Object.values(Permission)`)

## Environment Configuration (added in Phase 2)

| Variable                | Default | Description                                    |
|-------------------------|---------|------------------------------------------------|
| `BIDDING_DURATION_HOURS`| `24`    | Hours the auction runs after the first bid     |
| `PAYMENT_WINDOW_HOURS`  | `18`    | Hours the winner has to complete payment       |
| `BID_INCREMENT_MIN_FLAT`| `5`     | Minimum flat increment in NPR                  |
| `BID_INCREMENT_PERCENT` | `0.10`  | Minimum increment as a fraction of current bid |

Until Phase 2 adds env validation, `ConfigService` must use the defaults above as runtime fallbacks.

## Phase Implementation Plan
- **Phase 1 (current)**: Entities, enums, DTOs, `BiddingService`, `AuctionLifecycleService`,
  `BiddingModule` wiring.
- **Phase 2**: Controllers, cron jobs, lazy closure in `ProductsService`, env variable
  validation, admin confirm-payment endpoint.
- **Phase 3**: Notification emails, database schema doc update, end-to-end verification.
