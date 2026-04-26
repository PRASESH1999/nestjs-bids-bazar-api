---
name: create-migration
description: >
  Use this skill when the user asks to create a database migration.
  Triggers include: "create a migration for X", "add a column to Y table",
  "generate a migration", "I need to rename a column", "add an index to Z",
  "create the bids table migration", "add a foreign key between X and Y",
  "drop a column from Z table", "add an enum value to X". Always read this
  skill before writing any TypeORM migration file.
---

# Skill: create-migration

## References — Read Before Starting

- [SKILL.md] — project context, open decisions
- [references/conventions.md] — naming rules
- [references/typeorm-patterns.md] — column types, indexes, constraints
- [references/environment.md] — ormconfig setup, migration commands

---

## Step 0 — Extract Migration Details

Before writing any code confirm:

| Detail | Extract From Request |
|---|---|
| Purpose | What schema change is needed? |
| Table(s) affected | Which table(s) are changing? |
| Change type | Create table / Add column / Drop column / Add index / Add FK / Rename / Alter type / Add enum value |
| Column types | Correct TypeORM types for new columns |
| Nullable | Is the new column nullable or not? |
| Default value | Does it need a default? |
| Indexes | Any new indexes needed? |
| Foreign keys | Any FK constraints? |
| Down migration | How to reverse the change? |

If any detail is ambiguous — ask before generating.
A wrong migration on production DB is extremely dangerous.

---

## Step 1 — Generate Migration Filename

Always follow this exact naming convention:
<timestamp>-<PascalCaseDescription>.ts

Generate timestamp with:
```bash
date +%s%3N    # Unix timestamp in milliseconds
# Example output: 1714000000000
```

Examples of correct migration names:
1714000000001-CreateBidsTable.ts
1714000000002-AddFallbackRankToBids.ts
1714000000003-CreateAuctionsTable.ts
1714000000004-AddPaymentDeadlineToAuctions.ts
1714000000005-AddIndexOnBidsAuctionId.ts
1714000000006-RenameStartPriceToStartingPrice.ts
1714000000007-AddBidStatusEnum.ts
1714000000008-CreateUsersTable.ts

---

## Step 2 — Migration File Location

src/database/migrations/<timestamp>-<PascalCaseDescription>.ts

---

## Step 3 — Migration Templates

### Create Table
```typescript
// src/database/migrations/<timestamp>-Create<Name>Table.ts
import {
  MigrationInterface, QueryRunner,
  Table, TableIndex, TableForeignKey,
} from 'typeorm';

export class Create<Name>Table<timestamp> implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create enum types BEFORE the table
    await queryRunner.query(`
      CREATE TYPE <name>_status_enum AS ENUM (
        'VALUE_ONE',
        'VALUE_TWO'
      )
    `);

    // Step 2: Create table
    await queryRunner.createTable(
      new Table({
        name: '<table_name>',           // snake_case plural
        columns: [
          // ── Primary Key ──────────────────────────────────────────────
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },

          // ── Monetary column ───────────────────────────────────────────
          {
            name: 'amount',
            type: 'decimal',
            precision: 18,
            scale: 2,
            isNullable: false,
          },

          // ── Enum column ───────────────────────────────────────────────
          {
            name: 'status',
            type: 'enum',
            enumName: '<name>_status_enum',
            enum: ['VALUE_ONE', 'VALUE_TWO'],
            default: "'VALUE_ONE'",
          },

          // ── Varchar column ────────────────────────────────────────────
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },

          // ── Text column ───────────────────────────────────────────────
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },

          // ── Integer column ────────────────────────────────────────────
          {
            name: 'duration_hours',
            type: 'int',
            isNullable: false,
          },

          // ── Boolean column ────────────────────────────────────────────
          {
            name: 'is_locked',
            type: 'boolean',
            default: false,
            isNullable: false,
          },

          // ── UUID foreign key column ───────────────────────────────────
          {
            name: 'owner_id',
            type: 'uuid',
            isNullable: false,
          },

          // ── Nullable UUID foreign key ─────────────────────────────────
          {
            name: 'current_winner_id',
            type: 'uuid',
            isNullable: true,
          },

          // ── Timestamp columns ─────────────────────────────────────────
          {
            name: 'closes_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'payment_deadline',
            type: 'timestamptz',
            isNullable: true,
          },

          // ── BaseEntity columns — always include these ─────────────────
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],

        // ── Foreign Keys ────────────────────────────────────────────────
        foreignKeys: [
          {
            name: 'fk_<table>_owner',
            columnNames: ['owner_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',       // Never CASCADE on bidding data
            onUpdate: 'NO ACTION',
          },
          {
            name: 'fk_<table>_winner',
            columnNames: ['current_winner_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'NO ACTION',
          },
        ],
      }),
      true,                             // ifNotExists = true
    );

    // Step 3: Create indexes AFTER table creation
    await queryRunner.createIndex(
      '<table_name>',
      new TableIndex({
        name: 'idx_<table>_owner_id',
        columnNames: ['owner_id'],
      }),
    );

    await queryRunner.createIndex(
      '<table_name>',
      new TableIndex({
        name: 'idx_<table>_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      '<table_name>',
      new TableIndex({
        name: 'idx_<table>_closes_at',
        columnNames: ['closes_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Always implement down() — never leave empty
    // Reverse order of up() — indexes and FKs drop with table
    await queryRunner.dropTable('<table_name>', true);
    await queryRunner.query(
      `DROP TYPE IF EXISTS <name>_status_enum`,
    );
  }
}
```

---

### Add Column
```typescript
// src/database/migrations/<timestamp>-Add<ColumnName>To<Table>.ts
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Add<ColumnName>To<Table><timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      '<table_name>',
      new TableColumn({
        name: '<column_name>',          // snake_case
        type: 'timestamptz',            // correct TypeORM type
        isNullable: true,               // must be nullable when adding to existing table
                                        // unless backfill migration runs first
      }),
    );

    // If adding a non-nullable column to existing table:
    // Step 1 — Add as nullable
    // Step 2 — Backfill existing rows
    // Step 3 — Alter to non-nullable
    // Never add non-nullable column without a default or backfill

    // Add index if this column will be frequently queried
    await queryRunner.createIndex(
      '<table_name>',
      new TableIndex({
        name: 'idx_<table>_<column>',
        columnNames: ['<column_name>'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index before dropping column
    await queryRunner.dropIndex(
      '<table_name>',
      'idx_<table>_<column>',
    );
    await queryRunner.dropColumn('<table_name>', '<column_name>');
  }
}
```

---

### Add Multiple Columns
```typescript
// src/database/migrations/<timestamp>-Add<Description>To<Table>.ts
import {
  MigrationInterface, QueryRunner, TableColumn,
} from 'typeorm';

export class Add<Description>To<Table><timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('<table_name>', [
      new TableColumn({
        name: 'first_bid_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'closes_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'payment_deadline',
        type: 'timestamptz',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('<table_name>', [
      'first_bid_at',
      'closes_at',
      'payment_deadline',
    ]);
  }
}
```

---

### Drop Column
```typescript
// src/database/migrations/<timestamp>-Drop<ColumnName>From<Table>.ts
import {
  MigrationInterface, QueryRunner, TableColumn,
} from 'typeorm';

export class Drop<ColumnName>From<Table><timestamp>
  implements MigrationInterface {

  // Store column definition for down() — needed to restore
  private readonly droppedColumn = new TableColumn({
    name: '<column_name>',
    type: 'varchar',
    length: '255',
    isNullable: true,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop index first if it exists
    await queryRunner.dropIndex(
      '<table_name>',
      'idx_<table>_<column>',
    );
    await queryRunner.dropColumn('<table_name>', '<column_name>');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the column exactly as it was
    await queryRunner.addColumn('<table_name>', this.droppedColumn);
  }
}
```

---

### Add Index
```typescript
// src/database/migrations/<timestamp>-AddIndexOn<Table><Column>.ts
import {
  MigrationInterface, QueryRunner, TableIndex,
} from 'typeorm';

export class AddIndexOn<Table><Column><timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      '<table_name>',
      new TableIndex({
        name: 'idx_<table>_<column>',
        columnNames: ['<column_name>'],
        // For unique index:
        // isUnique: true,
        // For composite index:
        // columnNames: ['<col1>', '<col2>'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      '<table_name>',
      'idx_<table>_<column>',
    );
  }
}
```

---

### Add Foreign Key
```typescript
// src/database/migrations/<timestamp>-AddForeignKey<Description>.ts
import {
  MigrationInterface, QueryRunner, TableForeignKey,
} from 'typeorm';

export class AddForeignKey<Description><timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add index on FK column first — always
    await queryRunner.createIndex(
      '<table_name>',
      new TableIndex({
        name: 'idx_<table>_<fk_column>',
        columnNames: ['<fk_column_name>'],
      }),
    );

    await queryRunner.createForeignKey(
      '<table_name>',
      new TableForeignKey({
        name: 'fk_<table>_<referenced_table>',
        columnNames: ['<fk_column_name>'],
        referencedTableName: '<referenced_table>',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',           // Never CASCADE on bidding data
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      '<table_name>',
      'fk_<table>_<referenced_table>',
    );
    await queryRunner.dropIndex(
      '<table_name>',
      'idx_<table>_<fk_column>',
    );
  }
}
```

---

### Rename Column
```typescript
// src/database/migrations/<timestamp>-Rename<OldName>To<NewName>In<Table>.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Rename<OldName>To<NewName>In<Table><timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn(
      '<table_name>',
      '<old_column_name>',
      '<new_column_name>',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse — rename back to original
    await queryRunner.renameColumn(
      '<table_name>',
      '<new_column_name>',
      '<old_column_name>',
    );
  }
}
```

---

### Add Enum Value
```typescript
// src/database/migrations/<timestamp>-Add<Value>To<Enum>Enum.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Add<Value>To<Enum>Enum<timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL: add enum value — cannot be rolled back easily
    await queryRunner.query(`
      ALTER TYPE <name>_status_enum ADD VALUE IF NOT EXISTS 'NEW_VALUE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // WARNING: PostgreSQL does not support removing enum values directly.
    // To roll back an enum value addition you must:
    // 1. Create a new enum without the value
    // 2. Alter the column to use the new enum
    // 3. Drop the old enum
    // This is complex — document here and handle manually if needed.
    // See: https://www.postgresql.org/docs/current/sql-altertype.html

    await queryRunner.query(`
      -- Manual rollback required for enum value removal
      -- See migration comments for steps
    `);
  }
}
```

---

### Alter Column Type
```typescript
// src/database/migrations/<timestamp>-Alter<Column>TypeIn<Table>.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Alter<Column>TypeIn<Table><timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Always use raw SQL for column type changes
    // TypeORM changeColumn has limitations with type alterations
    await queryRunner.query(`
      ALTER TABLE <table_name>
      ALTER COLUMN <column_name> TYPE <new_type>
      USING <column_name>::<new_type>
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE <table_name>
      ALTER COLUMN <column_name> TYPE <old_type>
      USING <column_name>::<old_type>
    `);
  }
}
```

---

### Backfill Data Migration
```typescript
// src/database/migrations/<timestamp>-Backfill<Description>.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Backfill<Description><timestamp>
  implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Always batch large backfills — never update all rows at once
    // This prevents table locks on large tables

    const BATCH_SIZE = 1000;
    let offset = 0;
    let updated = 0;

    do {
      const result = await queryRunner.query(`
        UPDATE <table_name>
        SET <column_name> = <default_value>
        WHERE <column_name> IS NULL
          AND id IN (
            SELECT id FROM <table_name>
            WHERE <column_name> IS NULL
            ORDER BY created_at
            LIMIT $1 OFFSET $2
          )
      `, [BATCH_SIZE, offset]);

      updated = result[1] ?? 0;
      offset += BATCH_SIZE;

    } while (updated === BATCH_SIZE);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the backfill — set back to null
    await queryRunner.query(`
      UPDATE <table_name>
      SET <column_name> = NULL
      WHERE <condition_to_identify_backfilled_rows>
    `);
  }
}
```

---

## Step 4 — Column Type Reference

| Data | TypeORM type | Notes |
|---|---|---|
| Monetary amounts | `decimal`, precision 18, scale 2 | Returns as string — parse carefully |
| Timestamps | `timestamptz` | Always timezone-aware |
| UUIDs | `uuid` | FK columns — not PK (BaseEntity handles PK) |
| Enums | `enum` with enumName | Always create type first |
| Short strings | `varchar` with length | Always set length |
| Long text | `text` | No length limit |
| Integers | `int` | Never for monetary |
| Booleans | `boolean` | Always set explicit default |
| JSON | `jsonb` | Flexible schemas only |

---

## Step 5 — Index Naming Convention

idx_<table_name>_<column_name(s)>
Examples:
idx_bids_auction_id
idx_bids_bidder_id
idx_bids_status
idx_auctions_status
idx_auctions_closes_at
idx_auctions_owner_id
idx_users_email

---

## Step 6 — FK Constraint Rules

onDelete: 'RESTRICT'    ← Always for bidding data — never CASCADE
onUpdate: 'NO ACTION'   ← Always
Why RESTRICT:

Prevents accidental deletion of auctions with bids
Prevents accidental deletion of users with bid history
Data integrity is critical in financial systems

---

## Step 7 — Run Commands

After generating the migration file:

```bash
# 1. Build first — migrations run from dist/
npm run build

# 2. Run pending migrations
npm run migration:run

# 3. Verify migration ran successfully
# Check DB schema matches entity definitions

# 4. Test down() migration in staging BEFORE production
npm run migration:revert
npm run migration:run     # Re-run to verify both directions work
```

---

## Step 8 — Safety Rules

✅ Always implement down() — never empty
✅ Test down() in staging before production
✅ New non-nullable columns must be nullable OR have a default
✅ Large data backfills must be batched (1000 rows per batch)
✅ Create indexes AFTER table — never in column definition
✅ Create enum types BEFORE table creation
✅ Use IF NOT EXISTS / IF EXISTS for safety
✅ Never CASCADE delete on bidding/financial data — always RESTRICT
✅ Always name FK constraints explicitly — never let TypeORM auto-name
✅ Build before running: npm run build then npm run migration:run
✅ Never edit a migration that has already run on staging or production
✅ Never modify existing column names in entity without a rename migration

---

## Step 9 — Final Checklist

  ✅ Filename follows: <timestamp>-<PascalCaseDescription>.ts
  ✅ File saved to: src/database/migrations/
  ✅ Class name includes timestamp: class CreateBidsTable1714000000001
  ✅ up() method fully implemented
  ✅ down() method fully implemented — never empty
  ✅ Enum types created before table in up()
  ✅ Indexes created after table in up()
  ✅ FK constraints use RESTRICT — never CASCADE
  ✅ All FK constraints have explicit names
  ✅ New non-nullable columns have default or backfill
  ✅ Column names are snake_case
  ✅ Table name is snake_case plural
  ✅ npm run build — zero errors before running
  ✅ npm run migration:run — runs successfully
  ✅ npm run migration:revert — reverses successfully (test in staging)