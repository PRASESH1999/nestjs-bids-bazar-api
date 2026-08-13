# Feature Enhancement Gap Analysis
### Instant Buy Visibility Logic & Separate Buyer/Seller Points System

**Source document:** *Bidsbazar Feature Enhancement Documentation.pdf*
**Prepared:** 2026-08-03
**Last updated:** 2026-08-12 (v6 — resolved the payment-window question:
the existing `AWAITING_PAYMENT` window and fallback-to-next-bidder chain
are kept as-is; the only change is that payment inside that window must
now be via gateway, not admin-manual/COD/bank-transfer)
**Scope:** `nestjs-bids-bazar-api` backend

---

## 0. What's Changing / Being Added in This Update (v6)

The single highest-priority open question from v5 is now resolved. No code
has changed — this is a documentation-only update.

1. **Delivery zone is chosen by the buyer.** "Inside Valley" vs. "Outside
   Valley" (§2.3) is a checkout-time selection made by the buyer — not
   derived from the buyer's saved address or the product/seller's
   location. Rule 13's currently-dormant location fields do **not** need
   to be activated for this feature.
2. **Resolved: the `AWAITING_PAYMENT` window and fallback-to-next-bidder
   chain are kept exactly as they are today.** The only change is *how*
   payment happens inside that window: gateway payment replaces
   admin-manual/COD/bank-transfer confirmation as the way to pay. If the
   winner doesn't complete gateway payment before `PAYMENT_WINDOW_HOURS`
   elapses, the existing fallback chain reassigns the product to the next
   bidder exactly as it does today. This is a much smaller change to
   `BiddingModule` than the alternative would have been — the state
   machine itself is untouched; only the payment-confirmation mechanism
   inside `AWAITING_PAYMENT` changes.

---

## 1. Executive Summary

Both features requested in the enhancement document are **greenfield
additions** — neither exists in the codebase today, not even as a partial
stub. What started as an Instant Buy visibility tweak has grown, through
clarification, into a broader payment-model change (upfront gateway
payment + COD delivery fee, universal) plus a full points/tier/commission
system — all touching `ProductsModule`, `BiddingModule`, `PaymentsModule`,
and `UsersModule`.

| Feature | Current State | Effort |
|---|---|---|
| Feature 1 — Instant Buy pricing/visibility **+ universal upfront-payment/COD-delivery model** | **Does not exist.** No `instantBuyPrice` field, no upfront-gateway-required payment path (today's model is admin-manual confirmation per Rule 14), no delivery-fee config, no buyer-selected delivery zone. | Medium–Large (grew due to the "applies to all sales" scope change) |
| Feature 2 — Buyer/Seller Points + Seller Tier & Profit-Share Commission | **Does not exist.** No point fields, no rewards module, no tier/commission concept, no admin settlement/points-adjustment endpoints. | Large |

Confirmed by direct code search: zero matches for `instantBuy`/`buyNow`
anywhere in `src/`, and zero matches for `buyerPoints`/`sellerPoints`/
`sellerTier`/`reward`/`commission` outside of an unrelated "tiered
fallback" used for similar-product recommendations (`products.service.ts`).
Also confirmed: no rule file among the 15 existing `.agents/rules/*.md`
files covers points, tiers, or commission — and Rule 14's current payment
model (`.agents/rules/rule-14-bidding-auction-lifecycle.md`) is entirely
admin-manual confirmation (`PAYMENT_CONFIRM_MANUAL`), with no gateway-based
payment path documented yet.

---

## 2. Feature 1: Instant Buy Pricing/Visibility + Universal Payment Model

### 2.1 Instant Buy — pricing & visibility (unchanged from v4)
- **Availability**: present on **every** product listing — not optional.
- **Pricing formula**:
  ```
  instantBuyPrice = basePrice + (0.4 × basePrice) = 1.4 × basePrice
  ```
  Always above `biddingStartPrice` (1.10×–1.20× `basePrice` per Rule 13's
  tiered markup).
- **Visibility rule**:
  - `currentBid < instantBuyPrice` → show
  - `currentBid = instantBuyPrice` → hide
  - `currentBid > instantBuyPrice` → hide

### 2.2 Universal Payment & Delivery Model (confirmed — applies to all sales)
- **Item price**: paid **in full, via the payment gateway** — for
  **every** sale, whether the buyer got there via Instant Buy or via
  winning a normal auction. This is no longer an Instant-Buy-specific
  rule.
- **Delivery fee**: always collected as **cash on delivery (COD)**, at
  the point of delivery — never at checkout, for any sale type.
- **Delivery zone**: the buyer **selects** "Inside Valley" or "Outside
  Valley" at checkout/order-confirmation time. This determines which of
  the two fixed, env-configured delivery rates applies (§2.4). It is a
  plain user choice — not derived from any address or location field.

> **✅ Resolved: Rule 14's `AWAITING_PAYMENT` state and fallback-to-
> next-bidder chain are kept exactly as they are today.** A normal auction
> winner still gets the existing `PAYMENT_WINDOW_HOURS` window to pay. The
> only change is *how* they pay inside that window: **gateway payment
> replaces admin-manual/COD/bank-transfer confirmation** as the mechanism.
> If the winner doesn't complete gateway payment before the window
> expires, the existing fallback chain reassigns the product to the next
> bidder exactly as it does today — unchanged. Instant Buy remains the one
> path where payment must succeed immediately (§2.1), since there's no
> next bidder to fall back to on that path (the auction closes at click
> time). This means the `BiddingModule` state machine itself is untouched
> — the change is scoped to swapping the payment-confirmation mechanism
> inside the existing states.

### 2.3 What currently exists
Nothing of this. Relevant facts:
- `Product` entity — no `instantBuyPrice`, no delivery-fee concept.
- Rule 14's payment model today is **entirely admin-manual confirmation**
  (`POST /admin/products/:productId/confirm-payment`, `paymentConfirmationMethod
  = ADMIN_MANUAL`) — there is no gateway-payment path documented yet. The
  existing `AWAITING_PAYMENT` window and fallback chain stay; only the
  confirmation mechanism inside that window changes to gateway payment.
- No delivery-fee configuration exists anywhere in the codebase or `.env`,
  and no buyer-facing "select delivery zone" field exists on any order/bid
  flow.

### 2.4 Gap — what needs to be added
1. **Schema change** — add `instantBuyPrice` (decimal, non-nullable) to
   `Product` + migration: `instantBuyPrice = round(basePrice × 1.4, 2)`.
2. **Visibility logic** — derived: `showInstantBuy = currentBid <
   instantBuyPrice`, where `currentBid = currentHighestBid ??
   biddingStartPrice`.
3. **Response mapping** — `instantBuyPrice` + `showInstantBuy` on
   `GET /products`, `GET /products/:id`, and the SSE `auction.update`
   payload.
4. **Delivery zone field** — a buyer-selected enum
   (`INSIDE_VALLEY | OUTSIDE_VALLEY`) captured at checkout/order
   confirmation, on whatever entity represents "the order/settlement for
   this bid or Instant Buy purchase."
5. **Delivery fee configuration** — fixed, env-sourced:
   ```
   DELIVERY_CHARGE_INSIDE_VALLEY=100
   DELIVERY_CHARGE_OUTSIDE_VALLEY=250
   ```
   (placeholder values — real amounts still TBD, §4 item 3). Collected as
   COD at delivery; excluded from points (§3.3).
6. **Gateway payment inside the existing payment window** — replace
   admin-manual/COD/bank-transfer confirmation with gateway payment as the
   mechanism for settling a normal auction win within
   `AWAITING_PAYMENT`/`PAYMENT_WINDOW_HOURS`. The state machine and
   fallback chain are unchanged; only the confirmation mechanism moves
   from `PAYMENT_CONFIRM_MANUAL`/admin action to a gateway callback/
   verification.
7. **Buy-Now purchase action** (Instant Buy specifically) — still closes
   the auction and assigns sole eligibility immediately on successful
   gateway payment, with no payment window (§2.1) since there's no
   fallback bidder on this path.

### 2.5 Rule changes required
- **Rule 13: Products / Listings** — add the mandatory Instant Buy
  subsection (`1.4 × basePrice` formula, always above `biddingStartPrice`).
- **Rule 14: Bidding & Auction Lifecycle** — swap the payment-confirmation
  mechanism inside the existing `AWAITING_PAYMENT` window from
  admin-manual to gateway payment (state machine + fallback chain
  unchanged); add the buyer-selected delivery zone field and COD
  delivery-fee timing; document Instant Buy's immediate-payment,
  no-fallback path as the one exception to "payment window applies."
- **New/updated payments rule** — fixed, env-configured, two-zone
  (buyer-selected) COD delivery fee, excluded from points; gateway payment
  is now the mechanism for item-price settlement across all sale types
  (relationship between the existing `confirm-payment` endpoint and the
  new "mark paid to seller" points trigger still needs clarifying — §4,
  item 3).

---

## 3. Feature 2: Buyer & Seller Points, Seller Tier & Profit-Share Commission

*(Unchanged from v4 — no new information this round. Included in full for
a single-document reference.)*

### 3.1 What's required
- Two independent balances per user: `buyerPoints`, `sellerPoints`.
- **Timing**: points are awarded only after an **admin manually flags the
  transaction as paid to the seller** (§3.3) — not automatically on any
  payment-gateway event, and not at time of sale.
- **Seller points** = `1% × soldPrice` (or `instantBuyPrice` for a
  Buy-Now sale). Example: Rs. 20,000 sale → 200 pts.
- **Buyer points** = `1% × the amount the buyer actually spent`, same
  admin-flagged timing.
- **Delivery charges are excluded** from both points calculations.
- **Buyer Points has no tier** (§3.4).
- **Seller Points drives a 5-tier structure**, with a profit-share
  commission % applied **unconditionally** on every sale (§3.5–3.6).
- **Refunds/returns are out of scope** — no returns provision exists.

### 3.2 What currently exists
Nothing. No points/tier/commission fields anywhere on `User`, no
rewards/loyalty module, and no admin-facing "mark transaction as paid"
action anywhere in the payments flow.

### 3.3 Points — calculation logic & trigger condition
```
trigger:  admin manually marks the transaction "paid to seller"
          (seller has already been paid offline by admin —
          the system does not move money to the seller itself)

transactedPrice = soldPrice (auction win) | instantBuyPrice (Buy-Now)
                  — delivery charge is NOT included

sellerPoints += round(0.01 × transactedPrice)
buyerPoints  += round(0.01 × transactedPrice)
```
Requires a new **admin endpoint/function**: list transactions pending
seller payout + "mark transaction #X as paid to seller" — the sole
trigger for point crediting on both sides. (Note: this is distinct from
Rule 14's existing `confirm-payment` endpoint, which confirms the
*buyer's* payment was received — "paid to seller" is a separate, later
admin action. See §4, item 3.)

### 3.4 Buyer Tier
- No tier structure — only a running `buyerPoints` balance, reserved for a
  future, not-yet-scoped redemption feature.

### 3.5 Commission Is a Share of *Profit* — Unconditional
```
profit = soldPrice − basePrice
```
**Worked example**: `basePrice = 100` → `biddingStartPrice = 120` →
`soldPrice = 150` → `profit = 50`. At 20% seller commission:
`sellerShare = 10`, `platformShare = 40`, `sellerPayout = 110`.

Always applies — `biddingStartPrice` is always above `basePrice` (10%
markup floor), so `profit` is always positive and commission is paid on
every settled sale, no exceptions. Instant Buy sales have a fixed,
deterministic profit: `0.4 × basePrice`.

### 3.6 Seller Tier & Commission Table

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

### 3.7 Gap — what needs to be added
1. **Schema** — `sellerPoints`, `buyerPoints`, `sellerTier` on a
   `UserRewards` entity (§3.9).
2. **`PointsTransaction` ledger table** — `userId, type, delta, reason,
   createdAt, referenceId`.
3. **Admin settlement action** — pending-payout view with computed
   `sellerPayout` reference amount, + "mark as paid to seller" action that
   triggers point crediting and `sellerTier` recalculation.
4. **Admin points-management endpoints** — manual credit/debit with a
   required reason, logged to the ledger.
5. **Commission calculator** — `sellerPayout = basePrice + (commission% ×
   profit)`.
6. **New module** — `RewardsModule`.
7. **Response/API exposure** — `buyerPoints`, `sellerPoints`, `sellerTier`
   on `GET /users/me`.

### 3.8 Rule changes required
- **New Rule 16: Loyalty Points, Seller Tier & Commission** — full model
  as above, including that refunds are explicitly out of scope.
- **Rule 13** — cross-reference: markup is no longer purely platform
  revenue (§4, item 2).
- **Rule 14** — document the admin settlement action, tied into whatever
  the payment-model decision in §4, item 1 produces.
- **User-profile rules** — extend `GET /users/me`.

### 3.9 Design decision: separate entity + ledger — confirmed
`UserRewards` entity + `PointsTransaction` ledger, needed for auditability
and to back admin adjustment/settlement endpoints.

---

## 4. Open Questions / Things to Confirm Before Implementation

1. **Rule 13 revenue-model implication (carried over, not yet answered).**
   Under unconditional commission, a high-tier seller can claim up to
   100% of the profit, meaning some or all of what was previously
   "platform-only" markup can flow back to the seller. Confirm this is the
   intended business outcome.
2. **Delivery fee actual amounts.** Placeholder values (`100`/`250`) are
   used in §2.4 — need real Inside/Outside Valley figures for `.env`.
3. **Is the existing `confirm-payment` admin endpoint the same action as
   the new "mark paid to seller" trigger (§3.3), or two separate steps
   (buyer-payment-confirmed vs. later seller-payout-confirmed)?** Current
   working assumption (§3.3): they are separate — `confirm-payment`
   confirms the buyer's gateway payment landed (closes out
   `AWAITING_PAYMENT` → `SETTLED`); "mark paid to seller" is a distinct,
   later admin action once the seller has actually been paid out, and is
   the one that triggers points. Worth an explicit confirmation before
   building both.

None of these three block starting Phase 1 (Instant Buy). Item 3 blocks
the points/commission admin action in Phase 2.

---

## 5. Rules Diff — Before vs. After

| Rule | Before | After (change required) |
|---|---|---|
| Rule 13: Products / Listings | Pricing model covers only `basePrice` → `biddingStartPrice` margin, implicitly platform-only revenue. No instant-buy concept. | Add **mandatory** `instantBuyPrice` field (`1.4 × basePrice`); note markup is no longer purely platform revenue once commission applies (§4, item 2). |
| Rule 14: Bidding & Auction Lifecycle | Payment is entirely admin-manual confirmation; `AWAITING_PAYMENT` + fallback chain exist to absorb non-payment risk over a window. | State machine + fallback chain **unchanged**; swap the in-window confirmation mechanism to gateway payment. Add: buyer-selected delivery zone, COD delivery-fee timing, Instant Buy's immediate-payment/no-window exception. |
| *(none today)* | No rule governs loyalty/points/tiers/commission. | **New Rule 16** — full points/tier/commission model, admin settlement action, ledger + adjustment endpoints, refunds out of scope. |
| User-profile rules | `GET /users/me` returns profile + KYC summary only. | Extend response shape with `buyerPoints`, `sellerPoints`, `sellerTier`. |
| Payments flow (no dedicated rule file today) | Admin-manual confirmation only; no gateway-required path. | Gateway payment is the mechanism for item-price settlement, all sales; fixed env-configured, buyer-selected-zone COD delivery fee; separate admin settlement action for points (relationship to existing confirm-payment endpoint per §4, item 3). |

---

## 6. Proposed Implementation Plan (Phased)

### Phase 0 — Decisions (does not block starting Phase 1)
- Get real delivery fee amounts (§4, item 2).
- Confirm §4, item 1 (Rule 13 revenue framing) — lower urgency, should
  land before Rule 16 is finalized.
- Confirm §4, item 3 (relationship between existing `confirm-payment` and
  the new "mark paid to seller" action) — must land before Phase 2's
  admin settlement action is built.

### Phase 1 — Feature 1: Instant Buy + Universal Payment Model
1. Migration: `instantBuyPrice` (`1.4 × basePrice`) on `Product`.
2. Service: derive `showInstantBuy`.
3. `.env`: `DELIVERY_CHARGE_INSIDE_VALLEY`, `DELIVERY_CHARGE_OUTSIDE_VALLEY`.
4. Buyer-selected delivery-zone field on the order/settlement path.
5. Swap `AWAITING_PAYMENT`'s confirmation mechanism from admin-manual to
   gateway payment; state machine and fallback chain unchanged.
6. Buy-Now endpoint (Instant Buy specifically): gateway payment success →
   immediate auction close → sole-buyer assignment, no payment window.
7. Update Rule 13 + Rule 14 docs.
8. Tests: visibility boundaries; gateway-payment requirement inside the
   window; fallback chain still triggers correctly on window expiry;
   correct delivery fee applied per buyer-selected zone.

### Phase 2 — Feature 2: Points, Tier & Commission
1. Migration: `UserRewards` + `PointsTransaction` + `sellerTier` enum.
2. `RewardsModule`: commission calculator (always-applied), tier resolver
   (seller-points-only), points service (1%, excludes delivery charge).
3. Admin settlement view + "mark as paid to seller" action, distinct from
   the existing `confirm-payment` endpoint (§4, item 3).
4. Admin points-adjustment endpoints.
5. Expose fields on `GET /users/me`.
6. Write **Rule 16** with the worked example verbatim.
7. Tests: worked example reproduces exactly; commission always applied;
   points/commission fire only on the admin "mark as paid to seller"
   action, never on `confirm-payment`; admin manual adjustment logs
   correctly.

### Phase 3 — Verification
- Manual pass through every worked example in this doc.
- Update `docs/database-schema.md`.

---

## 7. Summary Checklist

**Feature 1 — Instant Buy + Universal Payment Model**
- [ ] Add non-nullable `instantBuyPrice` column + migration (`1.4 ×
      basePrice`)
- [ ] Compute `showInstantBuy` in list/detail/SSE responses
- [ ] Add buyer-selected delivery-zone field + `.env` fee config
- [ ] Swap `AWAITING_PAYMENT` confirmation to gateway payment (state
      machine + fallback chain unchanged)
- [ ] Build Buy-Now endpoint requiring immediate full gateway payment, no
      payment window
- [ ] Update Rule 13 & Rule 14
- [ ] Tests for visibility boundaries + payment flow (incl. fallback
      chain still works on window expiry)

**Feature 2 — Buyer/Seller Points, Seller Tier & Commission**
- [ ] Build `UserRewards` entity + `PointsTransaction` ledger
- [ ] Build commission calculator (always-applied profit-share formula)
- [ ] Build admin "settlement pending" view + "mark as paid to seller"
      action (distinct from `confirm-payment`)
- [ ] Build admin points-adjustment endpoints
- [ ] Guarantee buyer points never affect seller tier (+ regression test)
- [ ] Expose on `GET /users/me`
- [ ] Write new Rule 16
- [ ] Update `docs/database-schema.md`

**Non-blocking decisions to close out alongside the work above**
- [ ] Real delivery fee amounts (§4.2)
- [ ] Confirm Rule 13 revenue-model implication (§4.1)
- [ ] Confirm relationship between `confirm-payment` and the new "mark
      paid to seller" action (§4.3) — needed before Phase 2's admin
      settlement action ships
