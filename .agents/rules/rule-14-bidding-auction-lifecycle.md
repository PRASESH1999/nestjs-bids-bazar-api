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

## Instant Buy

- Every product has a mandatory `instantBuyPrice` (see Rule 13 for the
  `1.4 × basePrice` formula and visibility rule). `AuctionLifecycleService
  .executeInstantBuy(productId, buyerId)` is the purchase action:
  `POST /products/:id/instant-buy`.
- Preconditions, re-validated **inside** a `pessimistic_write` lock on the
  product row (never from a pre-lock read, to close the race against a
  concurrent bid or a concurrent `closeIfExpired`/expiry): product status
  is `PENDING` or `ACTIVE`; caller is not the owner; `showInstantBuy` is
  still true at lock time.
- On success: creates a synthetic `Bid` at `instantBuyPrice` with
  `isInstantBuy = true`, `isOriginalWinner = true`, `fallbackRank = 0`,
  `isCurrentlyPaymentResponsible = true`; every other bid on the product
  is permanently set `NOT_RESPONSIBLE`; product transitions straight to
  `AWAITING_PAYMENT` (`biddingEndsAt = now`, `closedAt = now`,
  `winningBidId` set). Emits `AUCTION_CLOSED` so `AuctionClosedHandler`
  re-broadcasts current state — the same event a normal auction-timer
  close emits.
- **No fallback, ever.** Once Instant Buy is used, that buyer is the sole
  eligible party for the product. `handlePaymentExpiry` checks
  `isInstantBuy` on the expiring responsible bid and, if true, skips the
  next-bidder search entirely and goes straight to `ABANDONED` — even
  though other (now `NOT_RESPONSIBLE`) bids may exist below it. This is
  the one place in the lifecycle where the fallback chain deliberately
  does not apply.
- Instant Buy still goes through the same `AWAITING_PAYMENT` /
  `PAYMENT_WINDOW_HOURS` / gateway-payment path as a normal win (see
  below) — the window exists only because Fonepay is a scan-and-wait QR
  flow, not because Instant Buy tolerates non-payment.

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

- **Gateway payment (Fonepay) is now the primary path for every sale** —
  normal auction wins and Instant Buy alike. The item price is paid in
  full via `POST /payments/:productId/initiate` → Fonepay intent QR →
  `PaymentsService.confirmSuccess` → `AuctionLifecycleService
  .confirmPaymentGateway(productId)`. The `AWAITING_PAYMENT` state and
  fallback chain are unchanged by this — only the confirmation mechanism
  moved from admin-manual to gateway for the common case.
- An admin-only endpoint `POST /admin/products/:productId/confirm-payment` (implemented in
  Phase 2) calls `AuctionLifecycleService.confirmPaymentManual(adminId, productId, deliveryZone)`.
- This endpoint is kept long-term as a backup mechanism even after bank API integration,
  for cases where the API fails or admin intervention is needed. Since this
  path bypasses the buyer-facing checkout that would normally capture the
  delivery zone, the admin supplies it in the request body on the buyer's
  behalf.
- On confirmation (either path):
    - Responsible bid: `paymentStatus = CONFIRMED`, `paymentConfirmedAt`, `paymentConfirmedById`,
      `paymentConfirmationMethod = ADMIN_MANUAL` or `BANK_API`.
    - Product: `status = SETTLED`, `settledAt = now`.
    - All other bids on this product: `paymentStatus = NOT_RESPONSIBLE` (clean final state).
    - Notify seller and buyer (Phase 3).
    - **Manual path only**: since it has no Fonepay-originated `Payment`
      row, `confirmPaymentManual` creates one directly (`status = SUCCESS`,
      `terminalId = 'ADMIN-MANUAL'`, a locally-generated `referenceLabel`,
      `deliveryZone`/`deliveryCharge` from the admin's input) so this sale
      flows through the same seller-settlement + points/commission
      pipeline as a gateway-paid sale (see Rule 16). `sellerPaidAt` stays
      null — settlement-to-seller is a separate, later admin action.

## Delivery Fee (all sales, cash on delivery)

- Fixed, two-zone fee — never calculated dynamically, never charged
  through the gateway: `DELIVERY_CHARGE_INSIDE_VALLEY` /
  `DELIVERY_CHARGE_OUTSIDE_VALLEY` (env-configured, see below).
- The buyer **selects** the zone (`DeliveryZone.INSIDE_VALLEY |
  OUTSIDE_VALLEY`) at checkout — a plain choice on the
  `POST /payments/:productId/initiate` request body, not derived from any
  address or the product's (currently out-of-scope) location fields.
- The resolved amount is snapshotted onto `Payment.deliveryCharge` at
  initiation time (same reasoning as `Payment.paymentDeadline` — immune to
  a later env change), collected in cash at the point of delivery.
- **Never counted toward points** — the 1% buyer/seller points calculation
  (Rule 16) is computed on the item price only.

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
| POST   /products/:id/instant-buy           | ❌     | ✅   | ❌    | ❌         |
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
| `DELIVERY_CHARGE_INSIDE_VALLEY`  | `100` | Fixed COD delivery fee, Inside Valley zone |
| `DELIVERY_CHARGE_OUTSIDE_VALLEY` | `250` | Fixed COD delivery fee, Outside Valley zone |

Until Phase 2 adds env validation, `ConfigService` must use the defaults above as runtime fallbacks.

## Phase Implementation Plan
- **Phase 1 (current)**: Entities, enums, DTOs, `BiddingService`, `AuctionLifecycleService`,
  `BiddingModule` wiring.
- **Phase 2**: Controllers, cron jobs, lazy closure in `ProductsService`, env variable
  validation, admin confirm-payment endpoint.
- **Phase 3**: Notification emails, database schema doc update, end-to-end verification.
