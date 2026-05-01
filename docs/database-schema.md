# Database Schema

> This file is auto-maintained. It must be updated alongside every entity or schema change.
> See [Rule 12: Database Schema Maintenance](.agents/rules/rule-12-database-schema-maintenance.md).

_Last updated: 2026-04-29 by agent (Products module added)_

---

## High-Level Relationships

```mermaid
erDiagram
    USER ||--o| KYCVERIFICATION : "has KYC"
    USER ||--o| BANKDETAIL : "has bank"
    USER ||--o{ EMAILVERIFICATIONTOKEN : "has tokens"
    USER ||--o{ PRODUCT : "lists"
    CATEGORY ||--o{ SUBCATEGORY : "contains"
    CATEGORY ||--o{ PRODUCT : "categorises"
    SUBCATEGORY ||--o{ PRODUCT : "categorises"
    PRODUCT ||--|{ PRODUCTIMAGE : "has images"
```

---

## Full Entity Relationship Diagram

```mermaid
erDiagram
    USER {
        uuid id PK
        string name
        string email UK
        string password
        enum role
        boolean isActive
        boolean isEmailVerified
        string hashedRefreshToken
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
        string currency
        int biddingDurationHours
        decimal currentHighestBid
        uuid currentHighestBidderId
        timestamp biddingStartedAt
        timestamp biddingEndsAt
        timestamp submittedAt
        uuid reviewedById
        timestamp reviewedAt
        string rejectionReason
        string locationProvince
        string locationDistrict
        string locationArea
        timestamp withdrawnAt
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

    USER ||--o| KYCVERIFICATION : "has KYC"
    USER ||--o| BANKDETAIL : "has bank"
    USER ||--o{ EMAILVERIFICATIONTOKEN : "has tokens"
    USER ||--o{ PRODUCT : "lists"
    CATEGORY ||--o{ SUBCATEGORY : "contains"
    CATEGORY ||--o{ PRODUCT : "categorises"
    SUBCATEGORY ||--o{ PRODUCT : "categorises"
    PRODUCT ||--|{ PRODUCTIMAGE : "has images"
```

---

## Entity Notes

### USER
- `password` is bcrypt-hashed before persistence — never store or log plaintext.
- `hashedRefreshToken` stores a bcrypt hash of the refresh token, not the raw token. Set to `null` on logout.
- `role` enum values: `SUPERADMIN`, `ADMIN`, `USER`. Default: `USER`.
- `isActive` soft-disables the account without deletion. Checked on every authenticated request.
- `deletedAt` enables TypeORM soft-delete via `@DeleteDateColumn`. Queries exclude soft-deleted rows by default.

### EMAILVERIFICATIONTOKEN
- Does **not** extend `BaseEntity` — has its own minimal schema (no `updatedAt`, no `deletedAt`).
- `tokenHash` stores the **SHA-256 hash** of the raw token only. The raw token is sent by email and never persisted.
- Tokens expire after **24 hours** (`expiresAt`) and are deleted immediately after a successful verification (single-use).
- `userId` is indexed for fast lookup but is not a TypeORM-defined `@ManyToOne` relation — it is a plain UUID column referencing `users.id`.

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
- `basePrice` is the user-entered desired price. `biddingStartPrice` is auto-computed as `basePrice * 1.10` and stored so the bidding module never recomputes it.
- `biddingDurationHours` — countdown duration (hours) after the first bid is placed; configurable per product, default 72.
- `currentHighestBid`, `currentHighestBidderId`, `biddingStartedAt`, `biddingEndsAt` — reserved for the future Bidding module; null until bidding begins.
- `reviewedById` references `users.id` (the admin who reviewed) — plain UUID column, no TypeORM relation.
- `locationProvince`, `locationDistrict`, `locationArea` — nullable, reserved for future location-based filtering.
- Composite indexes: `(status, createdAt)` for public listing, `(ownerId, status)` for "my products" queries, `(categoryId, subcategoryId)` for filters.
- `deletedAt` soft-delete inherited from `BaseEntity`.

### PRODUCTIMAGE
- `productId` is a foreign key with `ON DELETE CASCADE` — images are hard-deleted when their product is hard-deleted.
- `(productId, displayOrder)` has a **composite unique constraint** — each display position is unique per product.
- `displayOrder: 0` designates the primary/thumbnail image.
- `filePath` stores the relative path on disk under `UPLOAD_BASE_DIR/products/:productId/`.
- Does **not** extend `BaseEntity` — has its own minimal schema (no `updatedAt`, no `deletedAt`).
