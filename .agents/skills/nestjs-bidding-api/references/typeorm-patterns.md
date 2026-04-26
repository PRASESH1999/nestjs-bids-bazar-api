# TypeORM Patterns Reference

> Read this before writing any entity, repository, query,
> transaction, or migration file.
> All DB access must go through repositories.
> Never use synchronize:true — migrations only, always.

---

## BaseEntity — All Entities Must Extend This

```typescript
// src/common/entities/base.entity.ts
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt: Date | null;
}
```

---

## Entity Rules

```typescript
// ✅ Correct entity pattern
import {
  Entity, Column, ManyToOne,
  JoinColumn, Index,
} from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { BidStatus } from '@common/enums/bid-status.enum';
import { UserEntity } from '@modules/users/entities/user.entity';
import { AuctionEntity } from '@modules/auctions/entities/auction.entity';

@Entity('bids')                          // snake_case plural table name
export class BidEntity extends BaseEntity {

  // ── Monetary columns — always decimal(18,2), never float ──────────────
  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  amount: string;                        // TypeORM returns decimal as string

  // ── Enum columns ──────────────────────────────────────────────────────
  @Column({
    name: 'status',
    type: 'enum',
    enum: BidStatus,
    default: BidStatus.SUBMITTED,
  })
  status: BidStatus;

  // ── Timestamp columns — always timestamptz ────────────────────────────
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  // ── Foreign key columns — always indexed ──────────────────────────────
  @ManyToOne(() => AuctionEntity, { nullable: false })
  @JoinColumn({ name: 'auction_id' })
  @Index('idx_bids_auction_id')
  auction: AuctionEntity;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'bidder_id' })
  @Index('idx_bids_bidder_id')
  bidder: UserEntity;

  // ── Frequently filtered columns — always indexed ───────────────────────
  // status and amount are filtered/sorted often in bid queries
}

// Add composite index for common query patterns
// e.g. find all bids for an auction ordered by amount
```

### Entity Column Type Rules
| Data Type | TypeORM Type | Notes |
|---|---|---|
| Monetary amounts | `decimal`, precision 18, scale 2 | Returns as `string` — parse carefully |
| Timestamps | `timestamptz` | Always timezone-aware |
| UUIDs | `uuid` (via PrimaryGeneratedColumn) | Never integer PKs |
| Enums | `enum` with TypeScript enum | Always string enums |
| Booleans | `boolean` | Default must be explicit |
| Short text | `varchar` with `length` | Always set max length |
| Long text | `text` | No length limit |
| JSON data | `jsonb` | Use for flexible schemas only |
| Integer counts | `int` | Never for monetary values |

---

## Repository Pattern — Standard Implementation

```typescript
// src/modules/bids/bids.repository.ts
import { Injectable } from '@nestjs/common';
import { DataSource, Repository, QueryRunner } from 'typeorm';
import { BidEntity } from './entities/bid.entity';
import { BidStatus } from '@common/enums/bid-status.enum';

@Injectable()
export class BidsRepository {
  private readonly repo: Repository<BidEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(BidEntity);
  }

  // ── Basic Queries ────────────────────────────────────────────────────

  async findById(id: string): Promise<BidEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['auction', 'bidder'],
    });
  }

  async findByIdOrFail(id: string): Promise<BidEntity> {
    return this.repo.findOneOrFail({
      where: { id },
      relations: ['auction', 'bidder'],
    });
  }

  async findAllByAuction(
    auctionId: string,
    options: {
      page: number;
      limit: number;
      status?: BidStatus;
    },
  ): Promise<[BidEntity[], number]> {
    const query = this.repo
      .createQueryBuilder('bid')
      .leftJoinAndSelect('bid.bidder', 'bidder')
      .where('bid.auction_id = :auctionId', { auctionId })
      .andWhere('bid.deleted_at IS NULL');

    if (options.status) {
      query.andWhere('bid.status = :status', { status: options.status });
    }

    return query
      .orderBy('bid.amount', 'DESC')
      .addOrderBy('bid.created_at', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
  }

  // ── Bidding-Specific Queries ──────────────────────────────────────────

  async findCurrentHighestBid(
    auctionId: string,
  ): Promise<BidEntity | null> {
    return this.repo
      .createQueryBuilder('bid')
      .where('bid.auction_id = :auctionId', { auctionId })
      .andWhere('bid.status = :status', { status: BidStatus.ACCEPTED })
      .andWhere('bid.deleted_at IS NULL')
      .orderBy('bid.amount', 'DESC')
      .addOrderBy('bid.created_at', 'ASC')
      .getOne();
  }

  async findFallbackChain(auctionId: string): Promise<BidEntity[]> {
    // Returns all ACCEPTED bids ranked for fallback
    // Highest amount first, earliest timestamp as tiebreaker
    return this.repo
      .createQueryBuilder('bid')
      .leftJoinAndSelect('bid.bidder', 'bidder')
      .where('bid.auction_id = :auctionId', { auctionId })
      .andWhere('bid.status = :status', { status: BidStatus.ACCEPTED })
      .andWhere('bid.deleted_at IS NULL')
      .orderBy('bid.amount', 'DESC')
      .addOrderBy('bid.created_at', 'ASC')
      .getMany();
  }

  async findBidderHasLeadingBid(
    auctionId: string,
    bidderId: string,
  ): Promise<boolean> {
    const highestBid = await this.findCurrentHighestBid(auctionId);
    if (!highestBid) return false;
    return highestBid.bidder.id === bidderId;
  }

  // ── Mutations ────────────────────────────────────────────────────────

  async create(
    data: Partial<BidEntity>,
    queryRunner?: QueryRunner,
  ): Promise<BidEntity> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(BidEntity)
      : this.repo;
    const entity = repo.create(data);
    return repo.save(entity);
  }

  async updateStatus(
    id: string,
    status: BidStatus,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(BidEntity)
      : this.repo;
    await repo.update(id, { status });
  }

  async softDelete(id: string): Promise<void> {
    // Never hard delete — soft delete only (Rule 4)
    await this.repo.softDelete(id);
  }

  // ── Transaction Support ───────────────────────────────────────────────

  createQueryRunner(): QueryRunner {
    return this.dataSource.createQueryRunner();
  }
}
```

---

## Transaction Pattern

Use transactions for ANY operation touching more than one table.
Critical bid operations that always require transactions:
- Placing a bid + updating auction highest bid
- Closing auction + assigning winner
- Payment failure + promoting next bidder

```typescript
// Standard transaction pattern — always use QueryRunner
async placeBidWithTransaction(
  bidData: Partial<BidEntity>,
  auctionId: string,
): Promise<BidEntity> {
  const queryRunner = this.dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Create the bid
    const bid = await this.bidsRepository.create(bidData, queryRunner);

    // 2. Update auction's current highest bid
    await this.auctionsRepository.updateHighestBid(
      auctionId,
      bid.id,
      queryRunner,
    );

    // Commit only when ALL operations succeed
    await queryRunner.commitTransaction();
    return bid;

  } catch (error) {
    // Always rollback on any failure
    await queryRunner.rollbackTransaction();
    // Always rethrow — never swallow transaction errors
    throw error;

  } finally {
    // Always release — prevents connection pool exhaustion
    await queryRunner.release();
  }
}
```

### Transaction Rules
- Always `connect()` before `startTransaction()`
- Always `commitTransaction()` or `rollbackTransaction()` — never leave open
- Always `release()` in `finally` — never skip
- Never silently swallow errors in catch — always rethrow after rollback
- Pass `queryRunner` to repository methods for transactional consistency
- Repository methods accept optional `queryRunner` parameter

---

## Pagination Pattern

```typescript
// Standard paginated query — always used for list endpoints
async findPaginated(options: {
  page: number;
  limit: number;
}): Promise<{
  __paginated: true;
  items: BidEntity[];
  meta: PaginationMeta;
}> {
  const [items, total] = await this.repo.findAndCount({
    where: { deletedAt: null },
    skip: (options.page - 1) * options.limit,
    take: options.limit,
    order: { createdAt: 'DESC' },
  });

  return {
    __paginated: true,      // Signal to ResponseInterceptor
    items,
    meta: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit),
    },
  };
}
```

### Pagination Rules
- Default page: 1, default limit: 20, max limit: 100
- Always validate via `PaginationQueryDto` in controller
- Never return unbounded result sets — always paginate list endpoints
- Use `__paginated: true` flag so `ResponseInterceptor` extracts `meta`

---

## Soft Delete Pattern

```typescript
// ✅ Always soft delete — never hard delete
await this.repo.softDelete(id);

// ✅ TypeORM automatically excludes soft-deleted records
// when @DeleteDateColumn is present — no extra where clause needed
const bids = await this.repo.find(); // excludes deleted automatically

// ✅ If you need to include deleted records explicitly
const allBids = await this.repo.find({
  withDeleted: true,
});

// ✅ Restore a soft-deleted record (if ever needed)
await this.repo.restore(id);

// ❌ Never hard delete any record
await this.repo.delete(id);          // Forbidden
await this.repo.remove(entity);      // Forbidden
```

---

## Relation Loading Rules

```typescript
// ✅ Always load relations explicitly where needed
const bid = await this.repo.findOne({
  where: { id },
  relations: ['auction', 'bidder'],  // Only what you need
});

// ✅ For complex joins use QueryBuilder
const bid = await this.repo
  .createQueryBuilder('bid')
  .leftJoinAndSelect('bid.auction', 'auction')
  .leftJoinAndSelect('bid.bidder', 'bidder')
  .where('bid.id = :id', { id })
  .getOne();

// ❌ Never use eager loading globally on entity
@ManyToOne(() => AuctionEntity, { eager: true })  // Forbidden
auction: AuctionEntity;

// ❌ Never select * — always select only what you need
// Avoid relations in list queries unless specifically needed
const bids = await this.repo.find({
  relations: ['auction', 'bidder', 'auction.seller'], // Too deep — avoid
});
```

---

## QueryBuilder Rules

```typescript
// ✅ Use QueryBuilder only when find() options are insufficient
// ✅ Always use parameterized queries — never string interpolation
const bids = await this.repo
  .createQueryBuilder('bid')
  .where('bid.auction_id = :auctionId', { auctionId })  // ✅ Parameterized
  .andWhere('bid.amount > :minAmount', { minAmount })    // ✅ Parameterized
  .getMany();

// ❌ Never interpolate user input into queries — SQL injection risk
const bids = await this.repo
  .createQueryBuilder('bid')
  .where(`bid.auction_id = '${auctionId}'`)             // ❌ Never
  .getMany();

// ✅ Use aliases consistently — always match entity name
.createQueryBuilder('bid')          // alias = 'bid'
.leftJoinAndSelect('bid.auction', 'auction')
.where('bid.status = :status', { status })
```

---

## Migration Patterns

### Generating a Migration
```bash
# Always build first — migrations run from dist/
npm run build

# Generate migration (TypeORM compares entities to DB schema)
npx typeorm migration:generate \
  src/database/migrations/CreateBidsTable \
  -d src/config/ormconfig.ts
```

### Migration File Structure
```typescript
// src/database/migrations/1714000000000-CreateBidsTable.ts
import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateBidsTable1714000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type first
    await queryRunner.query(`
      CREATE TYPE bid_status_enum AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'ACCEPTED',
        'REJECTED',
        'PAYMENT_DEFAULTED'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'bids',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'DRAFT', 'SUBMITTED',
              'ACCEPTED', 'REJECTED',
              'PAYMENT_DEFAULTED',
            ],
            default: "'SUBMITTED'",
          },
          {
            name: 'submitted_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'auction_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'bidder_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['auction_id'],
            referencedTableName: 'auctions',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',         // Never cascade delete bids
          },
          {
            columnNames: ['bidder_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // Always create indexes after table
    await queryRunner.createIndex(
      'bids',
      new Index({
        name: 'idx_bids_auction_id',
        columnNames: ['auction_id'],
      }),
    );

    await queryRunner.createIndex(
      'bids',
      new Index({
        name: 'idx_bids_bidder_id',
        columnNames: ['bidder_id'],
      }),
    );

    await queryRunner.createIndex(
      'bids',
      new Index({
        name: 'idx_bids_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Always implement down() — never leave empty
    await queryRunner.dropTable('bids');
    await queryRunner.query(`DROP TYPE IF EXISTS bid_status_enum`);
  }
}
```

### Migration Rules
- Never use `synchronize: true` — not even in development
- Always implement `down()` — never leave it empty
- Always create indexes after creating tables
- Never cascade delete bids or auctions — use `RESTRICT`
- Always run migrations before starting app on deployment
- Always test `down()` migration in staging before production
- Naming: `<timestamp>-<PascalCaseDescription>.ts`

---

## N+1 Prevention

```typescript
// ❌ N+1 problem — never do this
const auctions = await this.repo.find();
for (const auction of auctions) {
  // This fires a separate query per auction — N+1
  const bids = await this.bidsRepo.findByAuction(auction.id);
}

// ✅ Use joins instead
const auctions = await this.repo.find({
  relations: ['bids'],    // Single query with JOIN
});

// ✅ Or use QueryBuilder for more control
const auctions = await this.repo
  .createQueryBuilder('auction')
  .leftJoinAndSelect('auction.bids', 'bid')
  .where('auction.status = :status', { status: AuctionStatus.ACTIVE })
  .getMany();
```

---

## TypeORM Error Handling in Repositories

```typescript
// ✅ In repositories — let errors bubble up, never swallow
// Exception: wrap transactions to ensure rollback, then rethrow

// ✅ In services — catch TypeORM errors and convert to domain exceptions
import { EntityNotFoundError, QueryFailedError } from 'typeorm';

async findById(id: string): Promise<BidEntity> {
  try {
    return await this.bidsRepository.findByIdOrFail(id);
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      throw new ResourceNotFoundException(`Bid ${id} not found`);
    }
    throw error;  // Rethrow unexpected errors — GlobalExceptionFilter handles
  }
}
```

---

## Decimal Handling Rules

```typescript
// TypeORM returns decimal columns as strings — always parse carefully
// ✅ Correct — compare as numbers
const bidAmount = parseFloat(bid.amount);
const currentHighest = parseFloat(currentBid.amount);
if (bidAmount <= currentHighest) {
  throw new BidBelowMinimumException();
}

// ✅ Store as string — TypeORM handles the decimal conversion
await this.repo.save({ amount: dto.amount.toString() });

// ❌ Never use floating point arithmetic on monetary values directly
const newAmount = bid.amount + 10;  // Wrong — string + number
```

---

## Required Indexes Summary

Always add these indexes — enforced by Rule 4:

| Table | Column(s) | Index Name | Reason |
|---|---|---|---|
| `bids` | `auction_id` | `idx_bids_auction_id` | All bid queries filter by auction |
| `bids` | `bidder_id` | `idx_bids_bidder_id` | Bidder history queries |
| `bids` | `status` | `idx_bids_status` | Fallback chain queries |
| `bids` | `amount` | `idx_bids_amount` | Sorting by highest bid |
| `auctions` | `status` | `idx_auctions_status` | Active auction queries |
| `auctions` | `closes_at` | `idx_auctions_closes_at` | Closing job scheduler |
| `users` | `email` | `idx_users_email` | Login queries |