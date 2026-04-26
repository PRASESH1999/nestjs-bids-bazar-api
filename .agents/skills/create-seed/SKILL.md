---
name: create-seed
description: >
  Use this skill when the user asks to create a seed file, add seed data,
  or populate the database with test or staging data. Triggers include:
  "create a seed for X", "add seed data for Y", "seed the payments table",
  "add staging data for auctions", "create test users for staging",
  "I need sample data for Z", "populate the DB with test data".
  Always read this skill before writing any seed file or seed runner logic.
---

# Skill: create-seed

## References — Read Before Starting

- [SKILL.md] — project context, open decisions
- [references/seeds.md] — full seed patterns and existing seed data
- [references/conventions.md] — naming rules
- [references/typeorm-patterns.md] — entity patterns
- [references/environment.md] — which environments seeds run in

---

## Step 0 — Extract Seed Details

Before writing any code confirm:

| Detail | Extract From Request |
|---|---|
| Entity to seed | Which table/entity? |
| Environment | Development, staging, or both? |
| Data purpose | Manual testing / E2E test data / Staging demo data |
| Dependencies | Does it depend on other seed data (users, auctions)? |
| Volume | How many records? |
| Fixed IDs needed | Will other seeds or tests reference these records? |

If the seed has dependencies — confirm the run order in index.ts.
If fixed IDs are needed — export them as constants.

---

## Step 1 — Check Existing Seeds

Before creating a new seed file always check:
- `src/database/seeds/index.ts` — what seeds already exist
- `references/seeds.md` — existing seed IDs and credentials

Never duplicate existing seed data.
Never create a seed that conflicts with existing fixed IDs.

---

## Step 2 — File Location & Naming

src/database/seeds/<name>.seed.ts
Examples:
src/database/seeds/payments.seed.ts
src/database/seeds/notifications.seed.ts
src/database/seeds/categories.seed.ts

---

## Step 3 — Seed File Template

```typescript
// src/database/seeds/<name>.seed.ts
import { DataSource } from 'typeorm';
import { <Name>Entity } from '@modules/<name>/entities/<name>.entity';
// Import dependency seed IDs if needed
import { SEED_USER_IDS } from './users.seed';
import { SEED_AUCTION_IDS } from './auctions.seed';

// ── Fixed IDs — export for cross-seed and test references ──────────────
// Use fixed IDs so seeds are stable across environments
// Format: 'seed-<entity>-<description>-<zero-padded-number>'
export const SEED_<NAME>_IDS = {
  <ITEM_1>: 'seed-<name>-<description>-000000000001',
  <ITEM_2>: 'seed-<name>-<description>-000000000002',
  <ITEM_3>: 'seed-<name>-<description>-000000000003',
} as const;

// ── Seed Data Definition ───────────────────────────────────────────────
interface Seed<Name> {
  id: string;
  // Add fields matching entity shape
  // Use dependency IDs for foreign keys
}

const SEED_<NAME>S: Seed<Name>[] = [
  {
    id: SEED_<NAME>_IDS.<ITEM_1>,
    // Field values that represent a realistic scenario
    // Cover different states for manual testing
  },
  {
    id: SEED_<NAME>_IDS.<ITEM_2>,
    // Different state/scenario
  },
  {
    id: SEED_<NAME>_IDS.<ITEM_3>,
    // Another scenario
  },
];

// ── Seed Function — always idempotent ─────────────────────────────────
export async function seed<Name>s(
  dataSource: DataSource,
): Promise<void> {
  const repo = dataSource.getRepository(<Name>Entity);

  let created = 0;
  let skipped = 0;

  for (const item of SEED_<NAME>S) {
    // Idempotency check — never insert duplicates
    const existing = await repo.findOne({ where: { id: item.id } });

    if (existing) {
      skipped++;
      continue;
    }

    await repo.save(
      repo.create({
        id: item.id,
        // Map seed data fields to entity
      }),
    );
    created++;
  }

  console.log(
    `  [<name>.seed] Created: ${created}, Skipped: ${skipped}`,
  );
}
```

---

## Step 4 — Seed Scenarios to Cover

Every seed file should cover these scenarios
to support manual testing on staging:

### For Entity with Status/State
```typescript
// Cover every meaningful state in the state machine
// Example for a payments entity:

const SEED_PAYMENTS: SeedPayment[] = [
  // ── PENDING state ────────────────────────────────────────────────────
  {
    id: SEED_PAYMENT_IDS.PENDING,
    status: PaymentStatus.PENDING,
    amount: '85000.00',
    auctionId: SEED_AUCTION_IDS.AWAITING_PAYMENT,
    payerId: SEED_USER_IDS.BIDDER_1,
    dueAt: hoursFromNow(16),
    paidAt: null,
  },

  // ── COMPLETED state ───────────────────────────────────────────────────
  {
    id: SEED_PAYMENT_IDS.COMPLETED,
    status: PaymentStatus.COMPLETED,
    amount: '4200.00',
    auctionId: SEED_AUCTION_IDS.SETTLED,
    payerId: SEED_USER_IDS.BIDDER_2,
    dueAt: hoursAgo(30),
    paidAt: hoursAgo(28),
  },

  // ── EXPIRED state ─────────────────────────────────────────────────────
  {
    id: SEED_PAYMENT_IDS.EXPIRED,
    status: PaymentStatus.EXPIRED,
    amount: '25000.00',
    auctionId: SEED_AUCTION_IDS.ACTIVE_HIGH_BIDS,
    payerId: SEED_USER_IDS.BIDDER_3,
    dueAt: hoursAgo(2),
    paidAt: null,
  },
];
```

### For Simple Reference Data
```typescript
// Categories, tags, config values etc.
const SEED_CATEGORIES: SeedCategory[] = [
  {
    id: SEED_CATEGORY_IDS.COLLECTIBLES,
    name: 'Collectibles',
    slug: 'collectibles',
    description: 'Rare and collectible items',
    isActive: true,
  },
  {
    id: SEED_CATEGORY_IDS.ART,
    name: 'Art',
    slug: 'art',
    description: 'Original artworks and prints',
    isActive: true,
  },
  {
    id: SEED_CATEGORY_IDS.JEWELRY,
    name: 'Jewelry',
    slug: 'jewelry',
    description: 'Fine jewelry and watches',
    isActive: true,
  },
];
```

---

## Step 5 — Time Helper Utilities

```typescript
// Always define these at the top of the seed file
// Makes seed data timestamps relative to when seeds run

const now = new Date();

const hoursFromNow = (hours: number): Date =>
  new Date(now.getTime() + hours * 60 * 60 * 1000);

const hoursAgo = (hours: number): Date =>
  new Date(now.getTime() - hours * 60 * 60 * 1000);

const daysAgo = (days: number): Date =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const daysFromNow = (days: number): Date =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
```

---

## Step 6 — Register in Seed Runner

After creating the seed file always update `index.ts`:

```typescript
// src/database/seeds/index.ts
import { seedAdmin } from './admin.seed';
import { seedUsers } from './users.seed';
import { seedAuctions } from './auctions.seed';
import { seedBids } from './bids.seed';
import { seed<Name>s } from './<name>.seed';    // ← Add import

async function runSeeds(): Promise<void> {
  // ...
  await seedAdmin(AppDataSource);
  await seedUsers(AppDataSource);
  await seedAuctions(AppDataSource);
  await seedBids(AppDataSource);
  await seed<Name>s(AppDataSource);              // ← Add in correct order
  // ...
}
```

### Dependency Order Rules
Always run seeds in this order — dependencies first:

1. admin.seed.ts         ← no dependencies
2. users.seed.ts         ← no dependencies
3. auctions.seed.ts      ← depends on users
4. bids.seed.ts          ← depends on users + auctions
5. <new>.seed.ts         ← depends on whatever it references

If the new seed depends on bids → run after bids.seed.ts
If the new seed is independent → run after users.seed.ts

---

## Step 7 — Update Seeds Reference

After creating the seed file always update
`references/seeds.md` with:

```markdown
## Seeded <Name>s

| ID Constant | Description | Purpose |
|---|---|---|
| `SEED_<NAME>_IDS.<ITEM_1>` | Description | What scenario it covers |
| `SEED_<NAME>_IDS.<ITEM_2>` | Description | What scenario it covers |
```

---

## Step 8 — Seed Rules Summary

```typescript
// ✅ Always idempotent — check before inserting
const existing = await repo.findOne({ where: { id: item.id } });
if (existing) { skipped++; continue; }

// ✅ Always use fixed UUIDs — export as constants
export const SEED_PAYMENT_IDS = {
  PENDING: 'seed-payment-pending-000000000001',
} as const;

// ✅ Always use 12 bcrypt rounds for passwords
const hashedPassword = await bcrypt.hash(password, 12);

// ✅ Never seed in production without explicit approval
// Seeds are for development and staging only

// ✅ Always cover multiple states — not just happy path
// Each entity should have seeds for all meaningful states

// ✅ Always log created vs skipped counts
console.log(`  [<name>.seed] Created: ${created}, Skipped: ${skipped}`);

// ✅ Always use relative time helpers for timestamps
// Never hardcode dates — they become stale

// ❌ Never hardcode UUIDs as strings inline — export as constants
repo.save({ id: '550e8400-...' });   // Wrong — use SEED_IDS constant

// ❌ Never store plain text passwords
repo.save({ password: 'plaintext' }); // Wrong — always bcrypt

// ❌ Never seed without idempotency check
await repo.save(repo.create({ ...item })); // Wrong — may duplicate

// ❌ Never use faker in seed files — data must be stable
// Factories (test/factories/) use faker — seeds use fixed data
```

---

## Step 9 — Final Checklist

  ✅ File saved to src/database/seeds/<name>.seed.ts
  ✅ Fixed UUIDs exported as SEED_<NAME>_IDS constants
  ✅ Seed function named seed<Name>s — matches convention
  ✅ Idempotency check on every record before insert
  ✅ Created/skipped counts logged
  ✅ Multiple states/scenarios covered — not just one
  ✅ Time helpers used — no hardcoded dates
  ✅ Dependency seed IDs imported correctly
  ✅ No plain text passwords — bcrypt 12 rounds
  ✅ Registered in index.ts in correct dependency order
  ✅ references/seeds.md updated with new seed data
  ✅ npm run seed:run — runs successfully
  ✅ npm run seed:run — runs again without duplicates (idempotent)