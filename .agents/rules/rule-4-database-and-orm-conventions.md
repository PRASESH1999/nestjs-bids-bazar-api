---
trigger: always_on
---

# Rule 4: Database & ORM Conventions

## Stack
- Database: PostgreSQL
- ORM: TypeORM
- All TypeORM configuration lives in config/ — never inline or scattered across modules.

## Repository Pattern — SRP & Wrapper Pattern
- All database access must go through a repository class — no exceptions.
- **Strict SRP**: Repositories must use the **Wrapper Pattern** (composition) rather than extending TypeORM's `Repository` class directly.
- Use `private readonly repo: Repository<Entity>` initialized via `DataSource.getRepository()`.
- Services must only call custom-named methods defined in the repository (e.g., `findById`, `saveBid`).
- Repositories are the only layer allowed to use TypeORM methods (`find`, `save`, `update`, `delete`, `createQueryBuilder`, etc.).
- Repositories must be provided and injected via NestJS DI — never instantiated manually.

## Entity Rules
- Every entity file lives in its module's entities/ folder.
- Every entity must have the following base columns — use a shared BaseEntity:
    id          : uuid (primary, generated via 'uuid')
    createdAt   : timestamp with time zone, default now()
    updatedAt   : timestamp with time zone, auto-updated
    deletedAt   : timestamp with time zone, nullable (soft delete)
- Always use UUIDs for primary keys — never auto-increment integers.
- Always use @Column({ type: 'timestamptz' }) for all timestamp fields.
- Never store amounts or prices as float — use decimal(18,2) for all monetary values.
- Enum columns must reference a TypeScript enum, stored as PostgreSQL enum type.

## Naming Conventions
- Table names: snake_case, plural (e.g. bids, auction_items, payment_records)
- Column names: snake_case (e.g. created_at, starting_price, payment_deadline)
- Foreign keys: <referenced_table_singular>_id (e.g. auction_id, bidder_id)
- Indexes: idx_<table>_<column> (e.g. idx_bids_auction_id)
- Enums: <entity>_<field>_enum (e.g. bid_status_enum, auction_status_enum)
- Entity class names: PascalCase singular (e.g. Bid, Auction, PaymentRecord)

## Migrations
- Never use TypeORM synchronize: true in staging or production.
- **Development Exception**: `synchronize: true` may be used in the development environment for rapid prototyping, but all schema changes must eventually be captured in migrations for deployment.
- All schema changes must go through a migration file for staging and production — no manual DB edits ever.
- Migration file naming: <timestamp>-<descriptive-name>.ts
  e.g. 1714000000000-CreateBidsTable.ts
- Each migration must have both an up() and a down() method implemented.
- Migrations are reviewed and approved before merging to main — treated like code.
- Run migrations automatically in CI before test suite.

## Query Rules
- Always use parameterized queries — never string-interpolate user input into queries.
- Use createQueryBuilder only when find() options are insufficient — prefer simple methods.
- Always select only the columns you need — never SELECT * in production queries.
- Paginate all list queries — never return unbounded result sets.
- Add database indexes on all foreign keys and frequently filtered columns:
    bids.auction_id
    bids.bidder_id
    bids.status
    bids.amount
    auctions.status
    auctions.closes_at

## Transactions
- Any operation that touches more than one table must use a TypeORM transaction.
- Critical bid operations that require transactions:
    Placing a bid + updating auction's current highest bid
    Closing an auction + assigning winner
    Failing a payment + promoting next bidder
- Use QueryRunner for explicit transaction control in repositories.
- Never let a partial write succeed — all-or-nothing for multi-table operations.

## Soft Deletes
- Never hard delete any record in the Bids Bazzar — use soft deletes only.
- All entities extend BaseEntity which includes deletedAt.
- Use TypeORM's @DeleteDateColumn() for soft delete support.
- All repository queries must automatically exclude soft-deleted records
  (TypeORM handles this automatically when @DeleteDateColumn is present).

## Relations
- Always define both sides of a relation explicitly (@OneToMany + @ManyToOne).
- Never use eager loading globally — always load relations explicitly where needed.
- Use @JoinColumn() explicitly on the owning side of every relation.
- Avoid deeply nested eager joins — use separate queries or QueryBuilder for complex joins.

## Connection & Config
- Database credentials loaded exclusively via NestJS ConfigModule from environment variables.
- Required environment variables:
    DB_HOST
    DB_PORT
    DB_NAME
    DB_USER
    DB_PASSWORD
    DB_SSL         (true in staging and production)
- Connection pooling settings defined in config/ — not hardcoded:
    DB_POOL_MIN    (default: 2)
    DB_POOL_MAX    (default: 10)
- SSL must be enabled for staging and production environments.