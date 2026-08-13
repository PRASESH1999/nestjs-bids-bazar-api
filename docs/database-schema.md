# Database Schema

> This file is auto-maintained. It must be updated alongside every entity or schema change.
> See [Rule 12: Database Schema Maintenance](.agents/rules/rule-12-database-schema-maintenance.md).

_Last updated: 2026-08-12 by agent (Instant Buy + Loyalty Points/Seller Tier/Commission — added `Product.instantBuyPrice`, `Bid.isInstantBuy`, `Payment` delivery-zone/fee and seller-settlement columns; added USERREWARDS and POINTSTRANSACTION entities)_

---

## High-Level Relationships

```mermaid
erDiagram
    USER ||--o| KYCVERIFICATION : "has KYC"
    USER ||--o| BANKDETAIL : "has bank"
    USER ||--o{ EMAILVERIFICATIONTOKEN : "has tokens"
    USER ||--o{ PASSWORDRESETTOKEN : "has reset tokens"
    USER ||--o| PENDINGEMAILCHANGE : "pending email change"
    USER ||--o{ PRODUCT : "lists"
    CATEGORY ||--o{ SUBCATEGORY : "contains"
    CATEGORY ||--o{ PRODUCT : "categorises"
    SUBCATEGORY ||--o{ PRODUCT : "categorises"
    PRODUCT ||--|{ PRODUCTIMAGE : "has images"
    USER ||--o{ BID : places
    PRODUCT ||--o{ BID : receives
    PRODUCT ||--o| BID : "winning bid"
    PRODUCT ||--o{ PAYMENT : "payment attempts"
    USER ||--o{ PAYMENT : "owes"
    USER ||--o| USERREWARDS : "has rewards"
    USER ||--o{ POINTSTRANSACTION : "point history"
```

---

## Full Entity Relationship Diagram

```mermaid
erDiagram
    USER {
        uuid id PK
        string name
        string username UK
        string email UK
        string password
        enum role
        boolean isActive
        boolean isEmailVerified
        string hashedRefreshToken
        timestamp nameChangedAt
        timestamp usernameChangedAt
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    EMAILVERIFICATIONTOKEN {
        uuid id PK
        uuid userId FK
        string tokenHash
        timestamp expiresAt
        timestamp createdAt
    }

    PASSWORDRESETTOKEN {
        uuid id PK
        uuid userId FK
        string tokenHash
        timestamp expiresAt
        timestamp createdAt
        timestamp deletedAt
    }

    PENDINGEMAILCHANGE {
        uuid id PK
        uuid userId FK,UK
        string newEmail
        string tokenHash
        timestamp expiresAt
        timestamp createdAt
    }

    KYCVERIFICATION {
        uuid id PK
        uuid userId FK,UK
        enum documentType
        string citizenshipFrontPath
        string citizenshipBackPath
        string passportPath
        json permanentAddress
        json temporaryAddress
        enum status
        string rejectionReason
        uuid reviewedBy
        timestamp reviewedAt
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    BANKDETAIL {
        uuid id PK
        uuid userId FK,UK
        string bankName
        string accountHolderName
        string accountNumber
        string branch
        string swiftCode
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    CATEGORY {
        uuid id PK
        string name UK
        string slug UK
        string iconPath
        int displayOrder
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    SUBCATEGORY {
        uuid id PK
        uuid categoryId FK
        string name
        string slug
        string iconPath
        int displayOrder
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    PRODUCT {
        uuid id PK
        uuid ownerId FK
        string title
        text description
        uuid categoryId FK
        uuid subcategoryId FK
        enum condition
        enum status
        decimal basePrice
        decimal biddingStartPrice
        decimal instantBuyPrice
        string currency
        int biddingDurationHours
        decimal currentHighestBid
        uuid currentHighestBidderId
        timestamp biddingStartedAt
        timestamp biddingEndsAt
        int viewCount
        timestamp submittedAt
        uuid reviewedById
        timestamp reviewedAt
        string rejectionReason
        string locationProvince
        string locationDistrict
        string locationArea
        timestamp withdrawnAt
        uuid winningBidId FK
        timestamp closedAt
        timestamp settledAt
        timestamp abandonedAt
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    PRODUCTIMAGE {
        uuid id PK
        uuid productId FK
        string filePath
        string originalFilename
        string mimeType
        int sizeBytes
        int displayOrder
        timestamp createdAt
    }

    BID {
        uuid id PK
        uuid productId FK
        uuid bidderId FK
        decimal amount
        timestamp placedAt
        decimal previousHighestAmount
        boolean wasFirstBid
        boolean isOriginalWinner
        int fallbackRank
        boolean isCurrentlyPaymentResponsible
        boolean isInstantBuy
        enum paymentStatus
        timestamp paymentDeadline
        timestamp paymentConfirmedAt
        uuid paymentConfirmedById
        enum paymentConfirmationMethod
        timestamp paymentWarningSentAt
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    USER ||--o| KYCVERIFICATION : "has KYC"
    USER ||--o| BANKDETAIL : "has bank"
    USER ||--o{ EMAILVERIFICATIONTOKEN : "has tokens"
    USER ||--o{ PASSWORDRESETTOKEN : "has reset tokens"
    USER ||--o| PENDINGEMAILCHANGE : "pending email change"
    USER ||--o{ PRODUCT : "lists"
    CATEGORY ||--o{ SUBCATEGORY : "contains"
    CATEGORY ||--o{ PRODUCT : "categorises"
    SUBCATEGORY ||--o{ PRODUCT : "categorises"
    PRODUCT ||--|{ PRODUCTIMAGE : "has images"
    USER ||--o{ BID : places
    PRODUCT ||--o{ BID : receives
    PRODUCT ||--o| BID : "winning bid"
    PRODUCT ||--o{ PAYMENT : "payment attempts"
    USER ||--o{ PAYMENT : "owes"

    PAYMENT {
        uuid id PK
        uuid productId FK
        uuid winnerUserId FK
        decimal amount
        string referenceLabel UK
        string terminalId
        text qrString
        text qrMessage
        text websocketUrl
        enum status
        string fonepayTraceId
        string paymentMessage
        timestamp paymentDeadline
        enum deliveryZone
        decimal deliveryCharge
        timestamp sellerPaidAt
        uuid sellerPaidById
        decimal sellerPayoutAmount
        decimal sellerCommissionPercent
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    USER ||--o| USERREWARDS : "has rewards"
    USER ||--o{ POINTSTRANSACTION : "point history"

    USERREWARDS {
        uuid id PK
        uuid userId UK
        int buyerPoints
        int sellerPoints
        enum sellerTier
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }

    POINTSTRANSACTION {
        uuid id PK
        uuid userId FK
        enum type
        int delta
        text reason
        uuid referenceId
        timestamp createdAt
        timestamp updatedAt
        timestamp deletedAt
    }
```

---

## Entity Notes

### USER
- `password` is bcrypt-hashed before persistence — never store or log plaintext.
- `hashedRefreshToken` stores a bcrypt hash of the refresh token, not the raw token. Set to `null` on logout.
- `role` enum values: `SUPERADMIN`, `ADMIN`, `USER`. Default: `USER`.
- `isActive` soft-disables the account without deletion. Checked on every authenticated request.
- `nameChangedAt` is `null` until the user exercises their one-time display-name change. Once set it cannot be cleared except by a SUPERADMIN via `POST /admin/users/:id/reset-name-change`.
- `username` is the public-facing handle (3–30 chars). It is **unique case-insensitively** — uniqueness is enforced on `LOWER(username)` in the service layer, backed by a column-level `unique` constraint. Stored as-typed for display; all lookups/comparisons are lowercased. `name` is private (emails, admin views, own profile only).
- `usernameChangedAt` mirrors `nameChangedAt` semantics: `null` means the one-time username-change quota is available. Once set it cannot be cleared except by a SUPERADMIN via `POST /admin/users/:id/reset-username-change`.
- `deletedAt` enables TypeORM soft-delete via `@DeleteDateColumn`. Queries exclude soft-deleted rows by default.

### EMAILVERIFICATIONTOKEN
- Does **not** extend `BaseEntity` — has its own minimal schema (no `updatedAt`, no `deletedAt`).
- `tokenHash` stores the **SHA-256 hash** of the raw token only. The raw token is sent by email and never persisted.
- Tokens expire after **24 hours** (`expiresAt`) and are deleted immediately after a successful verification (single-use).
- `userId` is indexed for fast lookup but is not a TypeORM-defined `@ManyToOne` relation — it is a plain UUID column referencing `users.id`.

### PASSWORDRESETTOKEN
- Does **not** extend `BaseEntity` — has its own minimal schema (no `updatedAt`).
- `tokenHash` stores the **SHA-256 hash** of the raw token only. The raw token is sent by email and never persisted, logged, or returned in any API response.
- Tokens expire after **1 hour** (`expiresAt`) and are hard-deleted immediately after a successful reset (single-use).
- `deletedAt` enables TypeORM soft-delete. When a new token is issued for a user, the existing token is **soft-deleted** (not hard-deleted). Soft-deleted rows remain in the table so the per-email rate-limit query (`countRequestsSince`) can count them — hard-deleting would make the count always ≤ 1 and break the 3-per-hour limit.
- A **daily cleanup cron** hard-deletes all rows (including soft-deleted) where `expiresAt < now - 7 days`, preventing table bloat.
- `userId` is indexed for fast lookup and for the soft-delete invalidation query. There is no TypeORM `@ManyToOne` relation — it is a plain UUID column referencing `users.id` with `ON DELETE CASCADE` semantics enforced at the application layer.

### PENDINGEMAILCHANGE
- Does **not** extend `BaseEntity` — has its own minimal schema (no `updatedAt`, no `deletedAt`).
- `userId` is both a foreign key and **unique** — enforces at most one pending request per user at any time. A new request replaces the previous one (hard-delete then insert).
- `newEmail` is stored as **plaintext** (not hashed). The sensitive secret is the `tokenHash`, not the destination address.
- `tokenHash` stores the **SHA-256 hash** of the raw token only. The raw token is sent to `newEmail` and never persisted.
- Tokens expire after **1 hour** (`expiresAt`) and are hard-deleted immediately after successful verification or when superseded.
- No soft-delete needed: rate limiting is handled by IP-level `@Throttle` in the controller; there is no per-email rate-limit count.
- A **daily cleanup cron** hard-deletes expired rows (where `expiresAt < now`) to handle requests that were never followed up.

### KYCVERIFICATION
- `userId` is both a foreign key and unique — enforces one KYC record per user.
- `documentType` enum values: `CITIZENSHIP`, `PASSPORT`.
- `status` enum values: `PENDING`, `APPROVED`, `REJECTED`. Default: `PENDING`.
- `permanentAddress` and `temporaryAddress` are `jsonb` columns with shape `{ street, city, district, province, country }`.
- `reviewedBy` is a UUID referencing `users.id` (the admin who reviewed) — stored as a plain column, no TypeORM relation defined.
- `deletedAt` soft-delete inherited from `BaseEntity`.

### BANKDETAIL
- `userId` is both a foreign key and unique — enforces one bank detail record per user.
- `accountNumber`, `branch`, and `swiftCode` are **AES-256-GCM encrypted** at the application layer before being written to the database. The stored values are ciphertext.
- `swiftCode` is nullable (not all banks require it).
- `deletedAt` soft-delete inherited from `BaseEntity`.

### CATEGORY
- `name` and `slug` are both globally unique across all categories.
- `slug` is auto-generated from `name` at creation time and is immutable after creation.
- `iconPath` stores the relative path to the icon file under `/public/category-icons/`.
- `displayOrder` controls the sort order in category listings (ascending).
- `isActive` soft-disables the category without deletion. Categories with active subcategories cannot be deleted.
- `deletedAt` soft-delete inherited from `BaseEntity`.

### SUBCATEGORY
- `categoryId` + `slug` has a **composite unique index** — slug must be unique within its parent category only (not globally).
- `slug` is auto-generated from `name` at creation time.
- `iconPath` stores the relative path to the icon file under `/public/category-icons/`.
- `displayOrder` controls sort order within the parent category.
- `isActive` soft-disables the subcategory without deletion.
- `deletedAt` soft-delete inherited from `BaseEntity`.

### PRODUCT
- `ownerId` references `users.id` — stored as a plain UUID column (no TypeORM `@ManyToOne` relation defined to avoid joins on every load).
- `condition` enum values: `NEW`, `LIKE_NEW`, `USED_GOOD`, `USED_FAIR`, `FOR_PARTS`.
- `status` enum values: `DRAFT`, `SUBMITTED`, `REJECTED`, `APPROVED`, `PENDING`, `ACTIVE`, `CLOSED`, `AWAITING_PAYMENT`, `SETTLED`, `PAYMENT_FAILED`, `ABANDONED`, `WITHDRAWN`. Default: `DRAFT`. See Rule 13 for full state machine.
- `basePrice` is the user-entered desired price. `biddingStartPrice` is auto-computed by applying a **tiered margin** to `basePrice` (20% ≤10k, 18% ≤20k, 16% ≤30k, 14% ≤40k, 12% ≤50k, 10% >50k — see Rule 13) and stored so the bidding module never recomputes it.
- `instantBuyPrice` is auto-computed as `1.4 × basePrice` (always above `biddingStartPrice`) — mandatory on every product, not seller-set. See Rule 13/14.
- `biddingDurationHours` — countdown duration (hours) after the first bid is placed; configurable per product, default 72.
- `currentHighestBid`, `currentHighestBidderId`, `biddingStartedAt`, `biddingEndsAt` — null until the first bid is placed.
- `viewCount` — detail-page view counter (default `0`). Incremented **atomically** (`UPDATE ... SET "viewCount" = "viewCount" + 1`) by `POST /products/:id/view`. Owner and admin (ADMIN/SUPERADMIN) views are excluded, and only `PUBLICLY_VISIBLE_STATUSES` count. No index — current scope has no view-based sort (Rule 13).
- `winningBidId` — references the `bids.id` of the bid that is currently payment-responsible (set when auction closes to `AWAITING_PAYMENT`) or the bid that led to `SETTLED`. Nullable; plain UUID column, no TypeORM relation.
- `closedAt` — timestamp when the auction timer expired and the product transitioned to `AWAITING_PAYMENT`.
- `settledAt` — timestamp when payment was confirmed and the product transitioned to `SETTLED`.
- `abandonedAt` — timestamp when all bidders in the fallback chain failed to pay and the product transitioned to `ABANDONED`.
- `reviewedById` references `users.id` (the admin who reviewed) — plain UUID column, no TypeORM relation.
- `locationProvince`, `locationDistrict`, `locationArea` — nullable, reserved for future location-based filtering.
- Composite indexes: `(status, createdAt)` for public listing, `(ownerId, status)` for "my products" queries, `(categoryId, subcategoryId)` for filters.
- `deletedAt` soft-delete inherited from `BaseEntity`.

### BID
- `productId` and `bidderId` are foreign keys stored as plain UUID columns with individual `@Index` decorators; TypeORM `@ManyToOne` relations are declared for `product` and `bidder` to enable JOIN-based queries.
- `amount` and `previousHighestAmount` are stored as `decimal(12,2)`. All monetary arithmetic in the service layer uses `decimal.js` — never JavaScript floats.
- `previousHighestAmount` — snapshot of `product.currentHighestBid` at the moment this bid was placed. `null` for the very first bid.
- `wasFirstBid` — true if this bid triggered the `PENDING → ACTIVE` product transition.
- `isOriginalWinner` — set to `true` on the highest bid when the auction closes; false for all other bids.
- `fallbackRank` — position in the payment fallback chain: `0` = original winner, `1` = first fallback, `2` = second fallback, etc.
- `isCurrentlyPaymentResponsible` — only ONE bid per product may have this `true` at any time. Enforced by a **partial unique index** on `(productId) WHERE "isCurrentlyPaymentResponsible" = true`.
- `isInstantBuy` — true only for the synthetic bid created by `AuctionLifecycleService.executeInstantBuy`. Instant Buy bids never enter the fallback chain: `handlePaymentExpiry` checks this flag and goes straight to `ABANDONED` instead of promoting the next bid. See Rule 14.
- `paymentStatus` enum values: `NOT_RESPONSIBLE` (default), `PENDING`, `CONFIRMED`, `EXPIRED`. See Rule 14 for the full payment state machine.
- `paymentDeadline` — only meaningful when `isCurrentlyPaymentResponsible = true`. Set to `now + PAYMENT_WINDOW_HOURS` when a bid becomes responsible.
- `paymentWarningSentAt` — set once when the ~2-hour warning email is dispatched. Prevents duplicate warning emails on subsequent cron runs; never reset once set.
- `paymentConfirmedById` — UUID of the admin who manually confirmed payment (plain column, no TypeORM relation).
- `paymentConfirmationMethod` enum values: `ADMIN_MANUAL`, `BANK_API`.
- Composite indexes: `(productId, amount)` for highest-bid lookup, `(bidderId, placedAt)` for "my bids" queries, `(paymentStatus, paymentDeadline)` for overdue payment cron, `(productId, fallbackRank)` for fallback chain promotion.
- `deletedAt` soft-delete inherited from `BaseEntity`.

### PRODUCTIMAGE
- `productId` is a foreign key with `ON DELETE CASCADE` — images are hard-deleted when their product is hard-deleted.
- `(productId, displayOrder)` has a **composite unique constraint** — each display position is unique per product.
- `displayOrder: 0` designates the primary/thumbnail image.
- `filePath` stores the relative path on disk under `UPLOAD_BASE_DIR/products/:productId/`.
- Does **not** extend `BaseEntity` — has its own minimal schema (no `updatedAt`, no `deletedAt`).

### PAYMENT
- Each row represents one Fonepay Intent Checkout **attempt** by a specific `winnerUserId` for a specific `productId`. A product can have many Payment rows: each failed/expired retry and any chain of different winners after forfeiture.
- `winnerUserId` is the bidder who is `isCurrentlyPaymentResponsible` on their `Bid` at the time this Payment row is created. It is copied onto the Payment so the row's accountability is immutable even after the Bid record changes responsibility.
- `referenceLabel` is the correlation key across the entire Fonepay flow and doubles as Fonepay's `prn`. It is **globally unique** (DB unique constraint). Format: alphanumeric only, ≤ 30 chars.
- `terminalId` — the Fonepay terminal that generated the QR (≤ 16 chars). Defaults to `FONEPAY_TERMINAL_ID` env var.
- `qrString` — full QR payload returned by Fonepay `generate-intent-qr`; used by the frontend to render a scannable desktop QR image.
- `qrMessage` — short payload used by the frontend to construct the mobile deep link: `${intentScheme}/?qrPayload=${encodeURIComponent(qrMessage)}`.
- `websocketUrl` — `thirdpartyQRWebSocketUrl` from the Fonepay response. The **backend** holds this WebSocket connection and relays verified payment events to the browser via SSE; the frontend never connects to Fonepay directly.
- `status` enum values: `PENDING` (QR generated, awaiting payment), `SUCCESS` (Fonepay confirmed), `FAILED` (Fonepay rejected), `EXPIRED` (payment window elapsed before confirmation). Default: `PENDING`.
- `fonepayTraceId` and `paymentMessage` — populated after a successful `getPaymentStatus` call to Fonepay; `null` while PENDING.
- `paymentDeadline` — copied from `Bid.paymentDeadline` at initiation time so the deadline is stable even if `PAYMENT_WINDOW_HOURS` changes between config reloads.
- At-most-one active attempt: a **partial unique index** on `(productId) WHERE status = 'PENDING'` prevents two in-flight QR attempts for the same product. Service layer additionally guards against creating a new attempt when a SUCCESS row already exists.
- `deliveryZone` (`INSIDE_VALLEY`/`OUTSIDE_VALLEY`) — chosen by the buyer at checkout, never derived from an address/location field. `deliveryCharge` is snapshotted from `DELIVERY_CHARGE_INSIDE_VALLEY`/`DELIVERY_CHARGE_OUTSIDE_VALLEY` at initiation time (same immutable-snapshot reasoning as `paymentDeadline`). Collected as cash on delivery — never through the gateway, never counted toward points. See Rule 14/16.
- `sellerPaidAt`/`sellerPaidById`/`sellerPayoutAmount`/`sellerCommissionPercent` — populated only by `RewardsService.markSellerPaid`, a separate and later admin action from the buyer-payment fields above. `sellerPaidAt IS NULL` on a `SUCCESS` row means the sale is pending seller settlement. See Rule 16.
- The admin-manual confirmation path (`confirmPaymentManual`) also creates a Payment row (`status = SUCCESS`, `terminalId = 'ADMIN-MANUAL'`) so every settled sale — gateway or manual — flows through the same seller-settlement pipeline.
- `deletedAt` soft-delete inherited from `BaseEntity`.

### USERREWARDS
- 1:1 with `USER` via a plain unique `userId` column — no TypeORM relation, same pattern as `KYCVERIFICATION`. Looked up manually in `RewardsService`.
- `buyerPoints`/`sellerPoints` (int, default `0`) — independent running balances, both earn 1% of a settled sale's item price (excludes delivery charge).
- `sellerTier` enum values: `BRONZE` (default), `SILVER`, `GOLD`, `PLATINUM`, `DIAMOND` — derived from cumulative `sellerPoints` only. Buyer points never influence this field. See Rule 16 for the full tier/commission table.
- No row existing for a user is not an error — treated as `{0, 0, BRONZE}` by `GET /users/me`.

### POINTSTRANSACTION
- Audit ledger — every point movement, automatic or admin-manual, is logged here.
- `type` enum values: `BUYER`, `SELLER`.
- `referenceId` is the triggering `Payment.id` for automatic awards (via `markSellerPaid`), `null` for a manual admin adjustment (via `adjustPoints`).
- `(userId, createdAt)` composite index for a user's point history.
