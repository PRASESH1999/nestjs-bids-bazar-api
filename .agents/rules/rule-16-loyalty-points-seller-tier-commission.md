---
trigger: always_on
---

# Rule 16: Loyalty Points, Seller Tier & Commission

## Definition
- Every user has two independent, un-tiered-except-for-seller balances:
  `buyerPoints` and `sellerPoints`.
- Both are stored on a separate `UserRewards` entity (`user_rewards` table),
  1:1 with `User` via a plain unique `userId` column — no ORM relation,
  same pattern as `KycVerification`. Looked up manually via
  `RewardsService.getOwnRewards`/`lockOrCreateRewards`.
- Every point movement, automatic or admin-manual, is logged to a
  `PointsTransaction` ledger (`points_transactions` table): `userId`,
  `type` (`BUYER`/`SELLER`), `delta`, `reason`, `referenceId` (the
  triggering `Payment.id`, or `null` for a manual admin adjustment),
  `createdAt`.
- `RewardsModule` (`src/modules/rewards/`) owns all of this — do not
  duplicate points/tier/commission logic in `ProductsModule`,
  `BiddingModule`, or `PaymentsModule`.

## Points — Formula & Trigger

```
trigger:        an admin manually marks the sale's Payment "paid to seller"
                 via RewardsService.markSellerPaid(paymentId, adminId)
                 — NEVER automatically on gateway payment success

transactedPrice = Payment.amount (the settled item price — soldPrice for a
                   normal auction win, instantBuyPrice for Buy-Now)
                   — the COD delivery charge is NEVER included

buyerPoints  += round(0.01 × transactedPrice)
sellerPoints += round(0.01 × transactedPrice)
```

- Both credits happen atomically, in the same transaction, at the same
  admin action — there is exactly one settlement event per sale, and it
  credits both sides.
- **Why the delay**: points are deliberately not awarded at time of
  purchase/sale, only once the seller has actually been paid (offline, by
  the admin), so that a sale is never rewarded before its cycle is fully
  closed. The platform currently has **no returns/refund provision**, so
  there is no points-clawback path to design — this is out of scope, not
  deferred.
- Buyer points have **no tier** — just a running balance, reserved as an
  explicit placeholder for a future, not-yet-scoped redemption feature. No
  spend/redeem logic exists today.

## Seller Tier & Commission

Seller Tier is derived from **cumulative `sellerPoints`**. Each band's
percentage is the **seller's share of the sale's profit** — not a platform
take-rate.

```
profit = Payment.amount − Product.basePrice
```

`basePrice` is the seller's own entered price (before the Rule 13 tiered
markup). `profit` is **always positive**: `biddingStartPrice` is always
above `basePrice` (Rule 13's markup table has a 10% floor), and a first
bid can never go below `biddingStartPrice` — so commission is paid on
**every** settled sale, unconditionally. There is no "sale too low, points
only" case.

```
sellerPayoutAmount  = basePrice + (commissionPercent / 100) × profit
platformRetains     = (1 − commissionPercent / 100) × profit
```

`sellerPayoutAmount` is the reference amount the admin transfers to the
seller **offline**, before calling `markSellerPaid`. The system never
moves money itself.

**Worked example** (from the agreed spec — reproduce exactly in tests):
`basePrice = 100` → `biddingStartPrice = 120` (20% markup band) → bidding
ends at `soldPrice = 150` → `profit = 50`. At a 20% commission band:
`sellerShare = 10`, `platformShare = 40`, `sellerPayoutAmount = 110`.

Instant Buy sales have a fixed, deterministic profit:
`instantBuyPrice − basePrice = 0.4 × basePrice` (since
`instantBuyPrice = 1.4 × basePrice`, per Rule 13).

**Tier is priced BEFORE this sale's own points are added** —
`calculateCommission` reads the seller's current `sellerPoints` balance,
looks up the band, and only afterward does `markSellerPaid` credit this
sale's points and recompute `sellerTier`. A sale is always priced off
already-earned standing; its own points only affect the *next* sale.

### Seller Tier & Commission Table

| Tier | Points Range (cumulative) | Sub-band | Seller's Share of Profit |
|---|---|---|---|
| **Bronze**   | 0 – 1,499       | 0 – 499           | 20% |
|              |                 | 500 – 999         | 25% |
|              |                 | 1,000 – 1,499     | 30% |
| **Silver**   | 1,500 – 2,999   | 1,500 – 1,999     | 35% |
|              |                 | 2,000 – 2,499     | 40% |
|              |                 | 2,500 – 2,999     | 45% |
| **Gold**     | 3,000 – 6,499   | 3,000 – 3,999     | 50% |
|              |                 | 4,000 – 4,999     | 55% |
|              |                 | 5,000 – 6,499     | 60% |
| **Platinum** | 6,500 – 12,499  | 6,500 – 7,999     | 65% |
|              |                 | 8,000 – 9,999     | 70% |
|              |                 | 10,000 – 12,499   | 75% |
| **Diamond**  | 12,500+         | 12,500 – 14,999   | 80% |
|              |                 | 15,000 – 19,999   | 90% |
|              |                 | 20,000+           | 100% |

Implemented as `COMMISSION_BANDS` in `RewardsService` — the applicable
band is the last one whose `min` the seller's points meet or exceed.

- **Buyer points must never influence `sellerTier`** — this is a hard
  constraint. `markSellerPaid` and `adjustPoints` only ever recompute
  `sellerTier` from a `SELLER`-type point change, never a `BUYER`-type one.

## Admin Settlement Flow

1. A sale settles normally (Rule 14: `confirmPaymentGateway` or
   `confirmPaymentManual`) — this produces a `Payment` row with
   `status = SUCCESS`, but `sellerPaidAt = null`.
2. `GET /admin/payments/pending-settlement` lists every such row (`status
   = SUCCESS AND sellerPaidAt IS NULL`), with the reference
   `sellerPayoutAmount` an admin would need to compute for transfer.
3. The admin pays the seller **offline** (bank transfer, etc.), then calls
   `POST /admin/payments/:id/mark-seller-paid`.
4. `RewardsService.markSellerPaid` — in one transaction:
   - Locks both the buyer's and seller's `UserRewards` rows, in a
     consistent order (sorted by `userId`) to avoid a deadlock against a
     concurrent settlement where the same two users appear in reversed
     buyer/seller roles on a different product.
   - Computes commission off the seller's **pre-this-sale** points.
   - Credits `buyerPoints`/`sellerPoints` (1% each), writes two
     `PointsTransaction` rows.
   - Recomputes `sellerTier`.
   - Writes `sellerPaidAt`, `sellerPaidById`, `sellerPayoutAmount`,
     `sellerCommissionPercent` onto the `Payment` row.
   - Emits `EventNames.SELLER_MARKED_PAID` (non-fatal, post-commit).
5. Rejects (idempotency guard) if `sellerPaidAt` is already set —
   `ConflictException`.

## Admin Points Adjustment

`POST /admin/users/:userId/points/adjust` (`RewardsService.adjustPoints`)
— manual credit/debit with a **required** `reason`, logged to the same
ledger with `referenceId = null`. Recalculates `sellerTier` only when
`type = SELLER`.

## Profile Exposure

`GET /users/me` includes a `rewards` object:
`{ buyerPoints, sellerPoints, sellerTier }`, sourced from
`RewardsService.getOwnRewards`. **No `UserRewards` row yet is not an
error** — it's treated as `{ 0, 0, BRONZE }`.

## Permissions

Added to `Permission` enum (`common/enums/permission.enum.ts`):

```
SETTLEMENT_MANAGE = 'settlement:manage' → ADMIN, SUPERADMIN
POINTS_ADJUST     = 'points:adjust'     → ADMIN, SUPERADMIN
```

## Endpoint Access Matrix

| Endpoint                                    | Public | USER | ADMIN | SUPERADMIN |
|----------------------------------------------|--------|------|-------|------------|
| GET  /admin/payments/pending-settlement       | ❌     | ❌   | ✅    | ✅         |
| POST /admin/payments/:id/mark-seller-paid     | ❌     | ❌   | ✅    | ✅         |
| POST /admin/users/:userId/points/adjust       | ❌     | ❌   | ✅    | ✅         |
| GET  /users/me (rewards field)                | ❌     | ✅   | ✅    | ✅         |

## Open Items (tracked, not blocking)
- Whether the tiered markup being partially reclaimable by high-tier
  sellers (via commission) is the intended long-term revenue model for
  Rule 13's pricing — flagged for business confirmation, not resolved
  here.
- Combined buyer+seller point redemption is a reserved future capability
  — do not merge the two balances into one column.
