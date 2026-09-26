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

Every bound below — and the bid amount itself — is a multiple of Rs. 5.
Minimums round **up** (`roundUpToMultipleOf5`, never weakened), maximums round
**down** (`roundDownToMultipleOf5`, never exceeded). The cap on how high
bidding can go is **`product.biddingEndPrice`** (basePrice × 1.6) — see Rule
13 — never `instantBuyPrice`; the two ceilings are independent.

### First bid (product status: `PENDING`)
- Amount must be ≥ `product.biddingStartPrice` (already a multiple of 5).
- Amount must be ≤ `min(roundDownToMultipleOf5(biddingStartPrice × (1 +
  BID_INCREMENT_PERCENT)), product.biddingEndPrice)`.
- On success:
    - Transitions product → `ACTIVE`
    - Sets `product.biddingStartedAt = now`
    - Sets `product.biddingEndsAt = now + BIDDING_DURATION_HOURS`

### Subsequent bids (product status: `ACTIVE`)
- Let `current` = `product.currentHighestBid` (always a multiple of 5)
- Let `percentInc` = `current × BID_INCREMENT_PERCENT`
- Let `minInc` = `BID_INCREMENT_MIN_FLAT`
- Let `maxInc` = `percentInc`
- If `minInc > maxInc` (low-price edge case where the flat floor exceeds the percentage):
    - Only `current + BID_INCREMENT_MIN_FLAT` is accepted
- Otherwise:
    - `current + minInc ≤ amount ≤ min(roundDownToMultipleOf5(current + maxInc), product.biddingEndPrice)`
- **The submitted bid amount itself must be an exact multiple of Rs. 5** — rejected
  otherwise, even if it falls within the min/max window.
- All amounts are NPR. Use a decimal arithmetic library (`decimal.js`) — never JS
  floats for money.

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

An `ACTIVE` auction closes on **either** of two independent triggers — both handled
by the same idempotent method:

```
AuctionLifecycleService.closeIfExpired(productId)
```

- **Timer expired**: `product.biddingEndsAt <= now`.
- **Ceiling reached**: `product.currentHighestBid >= product.biddingEndPrice` — a
  regular bid landed exactly on the 60% hard ceiling (Rule 13). This is what makes
  reaching that ceiling end the auction immediately instead of waiting out the timer.

Call sites:
- Cron job runs every 1 minute (`closeAllExpiredAuctions`) — its query matches
  either trigger, not just timer expiry.
- Lazy closure check inside `GET /products/:id`, and **both before and after**
  `POST /products/:id/bids` (the post-bid call is what closes the auction within
  seconds of a bid hitting `biddingEndPrice`, rather than waiting for the cron).

### `closeIfExpired` must:
- Open a transaction with `SELECT FOR UPDATE` on the product row.
- Re-check `status` and (timer-expired OR ceiling-reached) INSIDE the transaction.
- If conditions are still met: pick the highest-amount bid as winner (tiebreaker: earliest
  `placedAt`), transition product to `AWAITING_PAYMENT`, set the winning bid's
  `paymentDeadline = now + PAYMENT_WINDOW_HOURS` and `isCurrentlyPaymentResponsible = true`.
  This is identical regardless of which trigger fired — a ceiling-triggered close still
  allows the normal fallback chain if the winner doesn't pay (unlike Instant Buy).
- Notify winner and seller (Phase 3).
- **Idempotent**: if status is already past `ACTIVE`, return without changes.

## Instant Buy

- Every product has a mandatory `instantBuyPrice` (see Rule 13 for the
  `1.4 × basePrice` formula and visibility rule) — completely independent of
  `biddingEndPrice` (the `1.6 × basePrice` regular-bidding ceiling, also Rule 13).
  `AuctionLifecycleService
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
  delivery address, the admin supplies `shippingAddressId` in the request
  body on the buyer's behalf (must belong to the winning bidder and already
  have a Pathao city/zone resolved).
- On confirmation (either path):
    - Responsible bid: `paymentStatus = CONFIRMED`, `paymentConfirmedAt`, `paymentConfirmedById`,
      `paymentConfirmationMethod = ADMIN_MANUAL` or `BANK_API`.
    - Product: `status = SETTLED`, `settledAt = now`.
    - All other bids on this product: `paymentStatus = NOT_RESPONSIBLE` (clean final state).
    - Notify seller and buyer (Phase 3).
    - **Manual path only**: since it has no Fonepay-originated `Payment`
      row, `confirmPaymentManual` creates one directly (`status = SUCCESS`,
      `terminalId = 'ADMIN-MANUAL'`, a locally-generated `referenceLabel`,
      `shippingAddressId` + resolved `deliveryCharge` from
      `DELIVERY_CHARGE_FLAT`) so this sale flows through the same
      seller-settlement + points/commission pipeline as a gateway-paid sale
      (see Rule 16), and — via the same `PAYMENT_SUCCEEDED` emission as the
      gateway path — gets a `ProductDelivery` row so it can be fulfilled
      through Pathao like any other sale. `sellerPaidAt` stays null —
      settlement-to-seller is a separate, later admin action.

## Delivery Fee & Fulfilment (Pathao integration)

- Fixed, flat fee — `DELIVERY_CHARGE_FLAT` (env-configured, see below),
  never calculated dynamically. Replaces the old two-zone COD model
  (`DeliveryZone`, `DELIVERY_CHARGE_INSIDE_VALLEY`/`OUTSIDE_VALLEY` — both
  removed).
- **Bundled into the Fonepay QR amount at checkout** — the gateway is asked
  for `itemAmount + deliveryCharge` as a single charge
  (`PaymentsService.initiatePayment`). There is no cash-on-delivery
  collection anymore; the Pathao order created at dispatch always has
  `amount_to_collect = 0`.
- `ProductPayment.amount` stays **item price only** — it is what
  `RewardsService` reads for commission/points math (Rule 16), so its
  meaning must never change. `ProductPayment.deliveryCharge` is a separate
  column, snapshotted at initiation time (same reasoning as
  `paymentDeadline` — immune to a later env change): together they're what
  the QR was actually generated for.
- `InitiatePaymentDto.shippingAddressId` is **required** — there is no way
  to fulfil a sale without a Pathao-resolvable delivery address. The chosen
  `ShippingAddress` must already have a Pathao city/zone (picked via
  `GET /pathao/cities` → `/cities/:id/zones` → `/zones/:id/areas`) and must
  resolve to a city inside `PATHAO_VALLEY_CITY_IDS` — **we can currently
  only fulfil inside Kathmandu Valley** — or `initiatePayment` rejects with
  `400`. The same address + serviceability check applies to
  `confirmPaymentManual` (the admin supplies `shippingAddressId` instead of
  a zone, since that path bypasses buyer-facing checkout).
- **Never counted toward points** — the 1% buyer/seller points calculation
  (Rule 16) is computed on `ProductPayment.amount` (item price) only.
- **Fulfilment is tracked separately**, on `ProductDelivery`
  (`product_deliveries`, one row per successful sale, `PathaoModule`) — not
  on `ProductPayment`/`Product`, which stay exactly as terminal at
  `SUCCESS`/`SETTLED` as before. A `PAYMENT_SUCCEEDED` listener creates the
  row (frozen recipient/address snapshot + the charged `deliveryCharge`)
  the moment a payment succeeds, via either path (gateway or admin-manual —
  `confirmPaymentManual` emits `PAYMENT_SUCCEEDED` too, specifically so both
  paths converge on this one listener). Admin then: marks it received at
  the warehouse (seller→warehouse is out of scope — sellers get their own
  item there), dispatches it (creates the real Pathao order, warehouse→
  buyer), and status is polled automatically until delivered. See
  `PathaoModule` for the full lifecycle.

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
| `DELIVERY_CHARGE_FLAT` | `130` | Flat delivery fee, bundled into the Fonepay QR amount |
| `PATHAO_BASE_URL` / `PATHAO_CLIENT_ID` / `PATHAO_CLIENT_SECRET` / `PATHAO_USERNAME` / `PATHAO_PASSWORD` | — | Pathao Courier Merchant API credentials (sandbox now, swap to live values only) |
| `PATHAO_STORE_ID` | — | The warehouse's single pre-registered Pathao Store id |
| `PATHAO_VALLEY_CITY_IDS` | — | Comma-separated Pathao `city_id`s we can currently fulfil to (Kathmandu Valley) |

Until Phase 2 adds env validation, `ConfigService` must use the defaults above as runtime fallbacks.

## Phase Implementation Plan
- **Phase 1 (current)**: Entities, enums, DTOs, `BiddingService`, `AuctionLifecycleService`,
  `BiddingModule` wiring.
- **Phase 2**: Controllers, cron jobs, lazy closure in `ProductsService`, env variable
  validation, admin confirm-payment endpoint.
- **Phase 3**: Notification emails, database schema doc update, end-to-end verification.
