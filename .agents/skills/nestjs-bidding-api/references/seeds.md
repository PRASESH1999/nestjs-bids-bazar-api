# Seeds Reference

> Read this before writing any seed file, seed runner,
> or any database pre-population logic.
> Seeds are for staging environment setup and consistent
> test data — never run in production without explicit approval.

---

## Seed File Locations
src/database/seeds/
├── index.ts                # Seed runner — imports and runs all seeds in order
├── admin.seed.ts           # Default admin user
├── roles.seed.ts           # Default role assignments
├── users.seed.ts           # Test bidders and auctioneers
├── auctions.seed.ts        # Sample auctions in various states
└── bids.seed.ts            # Sample bids on seeded auctions

---

## Core Seed Rules

- Seeds are always idempotent — running twice must produce the same result.
- Never hard-delete existing seed data — check before inserting.
- Never run seeds in production without explicit user approval.
- Seeds use real bcrypt hashing — never store plain text passwords.
- Seed data references must be consistent — bids reference seeded auctions.
- Always run seeds in correct order — dependencies first.
- All seed files export a single async function: seed<Name>(dataSource).

---

## Seed Runner

```typescript
// src/database/seeds/index.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { seedAdmin } from './admin.seed';
import { seedUsers } from './users.seed';
import { seedAuctions } from './auctions.seed';
import { seedBids } from './bids.seed';

// Load correct .env file based on NODE_ENV
dotenv.config({
  path: path.resolve(
    process.cwd(),
    `.env.${process.env.NODE_ENV ?? 'development'}`,
  ),
});

async function runSeeds(): Promise<void> {
  const { AppDataSource } = await import('../../../src/config/ormconfig');

  await AppDataSource.initialize();
  console.log('Database connected — running seeds...');

  try {
    // Always run in dependency order
    await seedAdmin(AppDataSource);
    await seedUsers(AppDataSource);
    await seedAuctions(AppDataSource);
    await seedBids(AppDataSource);

    console.log('All seeds completed successfully.');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

void runSeeds();
```

---

## Admin Seed

```typescript
// src/database/seeds/admin.seed.ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '@modules/users/entities/user.entity';
import { Role } from '@common/enums/role.enum';

export async function seedAdmin(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(UserEntity);

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@bidsbazarapi.com';

  // Idempotent — skip if already exists
  const existing = await repo.findOne({
    where: { email: adminEmail },
  });

  if (existing) {
    console.log(`  [admin.seed] Admin already exists — skipping.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD ?? 'Admin123!ChangeMe',
    12,
  );

  await repo.save(
    repo.create({
      email: adminEmail,
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      roles: [Role.ADMIN],
      isLocked: false,
      failedLoginAttempts: 0,
    }),
  );

  console.log(`  [admin.seed] Admin user created: ${adminEmail}`);
}
```

---

## Users Seed

```typescript
// src/database/seeds/users.seed.ts
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '@modules/users/entities/user.entity';
import { Role } from '@common/enums/role.enum';

// Fixed UUIDs for consistency across seed runs
// Reference these in other seeds that need user IDs
export const SEED_USER_IDS = {
  BIDDER_1:     'seed-user-bidder-1-000000000001',
  BIDDER_2:     'seed-user-bidder-2-000000000002',
  BIDDER_3:     'seed-user-bidder-3-000000000003',
  AUCTIONEER_1: 'seed-user-auctioneer-1-00000001',
  AUCTIONEER_2: 'seed-user-auctioneer-2-00000002',
} as const;

const SEED_PASSWORD = 'Seed123!Password';  // Same password for all seed users

interface SeedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
}

const SEED_USERS: SeedUser[] = [
  {
    id: SEED_USER_IDS.BIDDER_1,
    email: 'bidder1@staging.bidsbazarapi.com',
    firstName: 'Alice',
    lastName: 'Bidder',
    roles: [Role.BIDDER],
  },
  {
    id: SEED_USER_IDS.BIDDER_2,
    email: 'bidder2@staging.bidsbazarapi.com',
    firstName: 'Bob',
    lastName: 'Bidder',
    roles: [Role.BIDDER],
  },
  {
    id: SEED_USER_IDS.BIDDER_3,
    email: 'bidder3@staging.bidsbazarapi.com',
    firstName: 'Carol',
    lastName: 'Bidder',
    roles: [Role.BIDDER],
  },
  {
    id: SEED_USER_IDS.AUCTIONEER_1,
    email: 'auctioneer1@staging.bidsbazarapi.com',
    firstName: 'Dave',
    lastName: 'Auctioneer',
    roles: [Role.AUCTIONEER],
  },
  {
    id: SEED_USER_IDS.AUCTIONEER_2,
    email: 'auctioneer2@staging.bidsbazarapi.com',
    firstName: 'Eve',
    lastName: 'Auctioneer',
    roles: [Role.AUCTIONEER],
  },
];

export async function seedUsers(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(UserEntity);
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);

  let created = 0;
  let skipped = 0;

  for (const user of SEED_USERS) {
    const existing = await repo.findOne({ where: { email: user.email } });

    if (existing) {
      skipped++;
      continue;
    }

    await repo.save(
      repo.create({
        id: user.id,
        email: user.email,
        password: hashedPassword,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        isLocked: false,
        failedLoginAttempts: 0,
      }),
    );
    created++;
  }

  console.log(
    `  [users.seed] Created: ${created}, Skipped: ${skipped}`,
  );
}
```

---

## Auctions Seed

```typescript
// src/database/seeds/auctions.seed.ts
import { DataSource } from 'typeorm';
import { AuctionEntity } from '@modules/auctions/entities/auction.entity';
import { AuctionStatus } from '@common/enums/auction-status.enum';
import { SEED_USER_IDS } from './users.seed';

// Fixed UUIDs for consistency
export const SEED_AUCTION_IDS = {
  PENDING:          'seed-auction-pending-000000000001',
  ACTIVE:           'seed-auction-active-0000000000002',
  ACTIVE_HIGH_BIDS: 'seed-auction-active-high-bids-003',
  CLOSED:           'seed-auction-closed-000000000004',
  AWAITING_PAYMENT: 'seed-auction-awaiting-pay-000005',
  SETTLED:          'seed-auction-settled-00000000006',
} as const;

interface SeedAuction {
  id: string;
  title: string;
  description: string;
  startingPrice: string;
  currentHighestBid: string | null;
  status: AuctionStatus;
  durationHours: number;
  firstBidAt: Date | null;
  closesAt: Date | null;
  paymentDeadline: Date | null;
  currentWinnerId: string | null;
  settledAt: Date | null;
  ownerId: string;
}

const now = new Date();
const hoursFromNow = (h: number): Date =>
  new Date(now.getTime() + h * 60 * 60 * 1000);
const hoursAgo = (h: number): Date =>
  new Date(now.getTime() - h * 60 * 60 * 1000);

const SEED_AUCTIONS: SeedAuction[] = [
  // ── PENDING — no bids yet ────────────────────────────────────────────
  {
    id: SEED_AUCTION_IDS.PENDING,
    title: 'Vintage Rolex Submariner 1965',
    description: 'Excellent condition. Original box and papers.',
    startingPrice: '5000.00',
    currentHighestBid: null,
    status: AuctionStatus.PENDING,
    durationHours: 24,
    firstBidAt: null,
    closesAt: null,
    paymentDeadline: null,
    currentWinnerId: null,
    settledAt: null,
    ownerId: SEED_USER_IDS.AUCTIONEER_1,
  },

  // ── ACTIVE — accepting bids ───────────────────────────────────────────
  {
    id: SEED_AUCTION_IDS.ACTIVE,
    title: 'Rare First Edition — The Great Gatsby',
    description: 'F. Scott Fitzgerald. First printing, 1925.',
    startingPrice: '1000.00',
    currentHighestBid: '1500.00',
    status: AuctionStatus.ACTIVE,
    durationHours: 24,
    firstBidAt: hoursAgo(2),
    closesAt: hoursFromNow(22),
    paymentDeadline: null,
    currentWinnerId: SEED_USER_IDS.BIDDER_1,
    settledAt: null,
    ownerId: SEED_USER_IDS.AUCTIONEER_1,
  },

  // ── ACTIVE — multiple high bids for fallback testing ──────────────────
  {
    id: SEED_AUCTION_IDS.ACTIVE_HIGH_BIDS,
    title: 'Banksy Original Print — Girl With Balloon',
    description: 'Authenticated. Certificate of authenticity included.',
    startingPrice: '10000.00',
    currentHighestBid: '25000.00',
    status: AuctionStatus.ACTIVE,
    durationHours: 48,
    firstBidAt: hoursAgo(4),
    closesAt: hoursFromNow(44),
    paymentDeadline: null,
    currentWinnerId: SEED_USER_IDS.BIDDER_2,
    settledAt: null,
    ownerId: SEED_USER_IDS.AUCTIONEER_2,
  },

  // ── CLOSED — timer expired, winner being notified ─────────────────────
  {
    id: SEED_AUCTION_IDS.CLOSED,
    title: 'Antique Persian Rug 18th Century',
    description: 'Hand-knotted silk. Exceptional condition.',
    startingPrice: '3000.00',
    currentHighestBid: '7500.00',
    status: AuctionStatus.CLOSED,
    durationHours: 24,
    firstBidAt: hoursAgo(25),
    closesAt: hoursAgo(1),
    paymentDeadline: null,
    currentWinnerId: SEED_USER_IDS.BIDDER_3,
    settledAt: null,
    ownerId: SEED_USER_IDS.AUCTIONEER_1,
  },

  // ── AWAITING_PAYMENT — 18hr window active ─────────────────────────────
  {
    id: SEED_AUCTION_IDS.AWAITING_PAYMENT,
    title: 'Gibson Les Paul 1959 Sunburst',
    description: 'All original. Played by session musician.',
    startingPrice: '50000.00',
    currentHighestBid: '85000.00',
    status: AuctionStatus.AWAITING_PAYMENT,
    durationHours: 24,
    firstBidAt: hoursAgo(26),
    closesAt: hoursAgo(2),
    paymentDeadline: hoursFromNow(16),
    currentWinnerId: SEED_USER_IDS.BIDDER_1,
    settledAt: null,
    ownerId: SEED_USER_IDS.AUCTIONEER_2,
  },

  // ── SETTLED — completed auction ───────────────────────────────────────
  {
    id: SEED_AUCTION_IDS.SETTLED,
    title: 'Andy Warhol Soup Can Lithograph',
    description: 'Limited edition. Hand signed.',
    startingPrice: '2000.00',
    currentHighestBid: '4200.00',
    status: AuctionStatus.SETTLED,
    durationHours: 24,
    firstBidAt: hoursAgo(72),
    closesAt: hoursAgo(48),
    paymentDeadline: hoursAgo(30),
    currentWinnerId: SEED_USER_IDS.BIDDER_2,
    settledAt: hoursAgo(28),
    ownerId: SEED_USER_IDS.AUCTIONEER_1,
  },
];

export async function seedAuctions(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(AuctionEntity);

  let created = 0;
  let skipped = 0;

  for (const auction of SEED_AUCTIONS) {
    const existing = await repo.findOne({ where: { id: auction.id } });

    if (existing) {
      skipped++;
      continue;
    }

    await repo.save(
      repo.create({
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        currentHighestBid: auction.currentHighestBid,
        status: auction.status,
        durationHours: auction.durationHours,
        firstBidAt: auction.firstBidAt,
        closesAt: auction.closesAt,
        paymentDeadline: auction.paymentDeadline,
        currentWinnerId: auction.currentWinnerId,
        settledAt: auction.settledAt,
        owner: { id: auction.ownerId },
      }),
    );
    created++;
  }

  console.log(
    `  [auctions.seed] Created: ${created}, Skipped: ${skipped}`,
  );
}
```

---

## Bids Seed

```typescript
// src/database/seeds/bids.seed.ts
import { DataSource } from 'typeorm';
import { BidEntity } from '@modules/bids/entities/bid.entity';
import { BidStatus } from '@common/enums/bid-status.enum';
import { SEED_USER_IDS } from './users.seed';
import { SEED_AUCTION_IDS } from './auctions.seed';

const hoursAgo = (h: number): Date =>
  new Date(Date.now() - h * 60 * 60 * 1000);

interface SeedBid {
  id: string;
  amount: string;
  status: BidStatus;
  submittedAt: Date;
  fallbackRank: number | null;
  auctionId: string;
  bidderId: string;
}

const SEED_BIDS: SeedBid[] = [
  // ── Bids on ACTIVE auction ───────────────────────────────────────────
  {
    id: 'seed-bid-active-1-000000000001',
    amount: '1200.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(1.5),
    fallbackRank: null,
    auctionId: SEED_AUCTION_IDS.ACTIVE,
    bidderId: SEED_USER_IDS.BIDDER_2,
  },
  {
    id: 'seed-bid-active-2-000000000002',
    amount: '1500.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(1),
    fallbackRank: null,
    auctionId: SEED_AUCTION_IDS.ACTIVE,
    bidderId: SEED_USER_IDS.BIDDER_1,
  },

  // ── Bids on ACTIVE_HIGH_BIDS auction (fallback chain ready) ──────────
  {
    id: 'seed-bid-high-1-0000000000003',
    amount: '15000.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(3.5),
    fallbackRank: 3,
    auctionId: SEED_AUCTION_IDS.ACTIVE_HIGH_BIDS,
    bidderId: SEED_USER_IDS.BIDDER_3,
  },
  {
    id: 'seed-bid-high-2-0000000000004',
    amount: '20000.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(3),
    fallbackRank: 2,
    auctionId: SEED_AUCTION_IDS.ACTIVE_HIGH_BIDS,
    bidderId: SEED_USER_IDS.BIDDER_1,
  },
  {
    id: 'seed-bid-high-3-0000000000005',
    amount: '25000.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(2),
    fallbackRank: 1,
    auctionId: SEED_AUCTION_IDS.ACTIVE_HIGH_BIDS,
    bidderId: SEED_USER_IDS.BIDDER_2,
  },

  // ── Bids on AWAITING_PAYMENT auction ─────────────────────────────────
  {
    id: 'seed-bid-awaiting-1-00000000006',
    amount: '70000.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(25),
    fallbackRank: 2,
    auctionId: SEED_AUCTION_IDS.AWAITING_PAYMENT,
    bidderId: SEED_USER_IDS.BIDDER_2,
  },
  {
    id: 'seed-bid-awaiting-2-00000000007',
    amount: '85000.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(24),
    fallbackRank: 1,
    auctionId: SEED_AUCTION_IDS.AWAITING_PAYMENT,
    bidderId: SEED_USER_IDS.BIDDER_1,
  },

  // ── Bids on SETTLED auction ───────────────────────────────────────────
  {
    id: 'seed-bid-settled-1-00000000008',
    amount: '2500.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(71),
    fallbackRank: 2,
    auctionId: SEED_AUCTION_IDS.SETTLED,
    bidderId: SEED_USER_IDS.BIDDER_3,
  },
  {
    id: 'seed-bid-settled-2-00000000009',
    amount: '4200.00',
    status: BidStatus.ACCEPTED,
    submittedAt: hoursAgo(70),
    fallbackRank: 1,
    auctionId: SEED_AUCTION_IDS.SETTLED,
    bidderId: SEED_USER_IDS.BIDDER_2,
  },
];

export async function seedBids(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(BidEntity);

  let created = 0;
  let skipped = 0;

  for (const bid of SEED_BIDS) {
    const existing = await repo.findOne({ where: { id: bid.id } });

    if (existing) {
      skipped++;
      continue;
    }

    await repo.save(
      repo.create({
        id: bid.id,
        amount: bid.amount,
        status: bid.status,
        submittedAt: bid.submittedAt,
        fallbackRank: bid.fallbackRank,
        auction: { id: bid.auctionId },
        bidder: { id: bid.bidderId },
      }),
    );
    created++;
  }

  console.log(
    `  [bids.seed] Created: ${created}, Skipped: ${skipped}`,
  );
}
```

---

## Seed Commands

```bash
# Run all seeds in development
npm run seed:run

# Run all seeds in staging
npm run seed:staging

# Never run seeds in production without explicit approval
# If needed in production (emergency only):
# NODE_ENV=production ts-node src/database/seeds/index.ts
```

---

## Seeded Data Reference

Use these credentials and IDs when testing manually in staging:

### Admin
| Field | Value |
|---|---|
| Email | `admin@bidsbazarapi.com` |
| Password | Set via `ADMIN_PASSWORD` env var |

### Test Users
| Name | Email | Role | Password |
|---|---|---|---|
| Alice Bidder | `bidder1@staging.bidsbazarapi.com` | BIDDER | `Seed123!Password` |
| Bob Bidder | `bidder2@staging.bidsbazarapi.com` | BIDDER | `Seed123!Password` |
| Carol Bidder | `bidder3@staging.bidsbazarapi.com` | BIDDER | `Seed123!Password` |
| Dave Auctioneer | `auctioneer1@staging.bidsbazarapi.com` | AUCTIONEER | `Seed123!Password` |
| Eve Auctioneer | `auctioneer2@staging.bidsbazarapi.com` | AUCTIONEER | `Seed123!Password` |

### Seeded Auctions
| ID Constant | Status | Purpose |
|---|---|---|
| `SEED_AUCTION_IDS.PENDING` | PENDING | Test first bid activation |
| `SEED_AUCTION_IDS.ACTIVE` | ACTIVE | Test normal bid placement |
| `SEED_AUCTION_IDS.ACTIVE_HIGH_BIDS` | ACTIVE | Test fallback chain |
| `SEED_AUCTION_IDS.CLOSED` | CLOSED | Test post-close behavior |
| `SEED_AUCTION_IDS.AWAITING_PAYMENT` | AWAITING_PAYMENT | Test payment window |
| `SEED_AUCTION_IDS.SETTLED` | SETTLED | Test settled state |

---

## Adding a New Seed — Checklist

  ✅ Seed function is idempotent — check before inserting
  ✅ Fixed UUIDs used — exported as constants for cross-seed references
  ✅ Seed registered in index.ts in correct dependency order
  ✅ No plain text passwords — always bcrypt hash with 12 rounds
  ✅ Never seeds in production without explicit approval
  ✅ Seeded data reference table updated in this file
  ✅ npm run seed:run tested locally before committing