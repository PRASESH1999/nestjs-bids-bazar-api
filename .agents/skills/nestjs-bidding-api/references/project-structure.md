# Project Structure Reference

> Read this before creating any file or folder.
> Every file has exactly one correct location — never improvise.
> When in doubt, refer to Section 3 of SKILL.md first.

---

## Full Project Tree
bids-bazar-api/
├── .agent/
│   ├── rules/                                # All 10 workspace rules
│   │   ├── rule-1-project-architecture-and-structure.md
│   │   ├── rule-2-api-design-standards.md
│   │   ├── rule-3-bidding-domain-logic.md
│   │   ├── rule-4-database-orm-conventions.md
│   │   ├── rule-5-auth-authorization.md
│   │   ├── rule-6-error-handling.md
│   │   ├── rule-7-events-queues.md
│   │   ├── rule-8-testing-rules.md
│   │   ├── rule-9-logging-observability.md
│   │   └── rule-10-environment-deployment.md
│   └── skills/                               # All workspace skills
│       ├── nestjs-bids-bazar-api/               # Master skill
│       │   ├── SKILL.md
│       │   └── references/
│       ├── create-module/
│       │   └── SKILL.md
│       ├── create-endpoint/
│       │   └── SKILL.md
│       └── ...
│
├── src/
│   ├── main.ts                               # App entry point only — no logic
│   ├── app.module.ts                         # Root module — imports all feature modules
│   ├── app.controller.ts                     # Health check endpoint only
│   │
│   ├── common/                               # Shared code used across all modules
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts     # Extracts user from JWT via nestjs-cls
│   │   │   ├── public.decorator.ts           # Marks route as public (no auth)
│   │   │   └── require-permissions.decorator.ts  # Declares required permissions
│   │   │
│   │   ├── dto/
│   │   │   ├── pagination-query.dto.ts       # Shared pagination query params
│   │   │   └── date-range-query.dto.ts       # Shared date range query params
│   │   │
│   │   ├── entities/
│   │   │   └── base.entity.ts                # BaseEntity (id, createdAt, updatedAt, deletedAt)
│   │   │
│   │   ├── enums/
│   │   │   ├── role.enum.ts                  # BIDDER, AUCTIONEER, ADMIN
│   │   │   └── permission.enum.ts            # All permission constants
│   │   │
│   │   ├── events/
│   │   │   └── event-names.ts                # All event name constants (single source of truth)
│   │   │
│   │   ├── exceptions/
│   │   │   ├── base.exception.ts             # BaseException extends HttpException
│   │   │   ├── error-codes.ts                # Registry of all error codes
│   │   │   ├── bid-below-minimum.exception.ts
│   │   │   ├── bid-increment-violation.exception.ts
│   │   │   ├── duplicate-leading-bid.exception.ts
│   │   │   ├── self-bidding.exception.ts
│   │   │   ├── auction-closed.exception.ts
│   │   │   ├── auction-not-active.exception.ts
│   │   │   ├── auction-not-found.exception.ts
│   │   │   ├── auction-ownership.exception.ts
│   │   │   ├── invalid-auction-state.exception.ts
│   │   │   ├── invalid-credentials.exception.ts
│   │   │   ├── token-expired.exception.ts
│   │   │   ├── refresh-token-reused.exception.ts
│   │   │   ├── account-locked.exception.ts
│   │   │   ├── insufficient-permissions.exception.ts
│   │   │   ├── payment-window-expired.exception.ts
│   │   │   ├── no-remaining-bidders.exception.ts
│   │   │   └── resource-not-found.exception.ts
│   │   │
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts    # Catches all exceptions, formats envelope
│   │   │
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts             # Validates access token globally
│   │   │   └── permissions.guard.ts          # Checks user permissions per route
│   │   │
│   │   ├── interceptors/
│   │   │   ├── response.interceptor.ts       # Wraps all responses in { data, meta, error }
│   │   │   └── logging.interceptor.ts        # Logs every request/response with requestId
│   │   │
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts            # Global validation pipe config
│   │   │
│   │   └── utils/
│   │       ├── response.util.ts              # buildResponse() helper
│   │       └── pagination.util.ts            # buildPaginationMeta() helper
│   │
│   ├── config/
│   │   ├── app.config.ts                     # App-level config (port, prefix, version)
│   │   ├── database.config.ts                # TypeORM config
│   │   ├── jwt.config.ts                     # JWT secrets and expiry
│   │   ├── throttler.config.ts               # Rate limiting config
│   │   ├── ormconfig.ts                      # TypeORM CLI config (migrations only)
│   │   └── config.validation.ts              # Joi validation schema for all env vars
│   │
│   ├── database/
│   │   ├── migrations/                       # All TypeORM migration files
│   │   │   └── <timestamp>-<name>.ts
│   │   └── seeds/                            # Seed files for staging + test data
│   │       ├── index.ts                      # Unified runner
│   │       ├── categories/                   # Category data, seed logic + runner
│   │       └── users/                        # User data, seed logic + runner
│   │
│   └── modules/
│       ├── auth/                             # Authentication module
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts            # /auth/login, /auth/register, /auth/refresh, /auth/logout
│       │   ├── auth.service.ts               # Token generation, validation, refresh rotation
│       │   ├── auth.service.spec.ts
│       │   ├── strategies/
│       │   │   └── jwt.strategy.ts           # Passport JWT strategy
│       │   └── dto/
│       │       ├── login.dto.ts
│       │       ├── register.dto.ts
│       │       ├── refresh-token.dto.ts
│       │       └── auth-response.dto.ts
│       │
│       ├── users/                            # Users module
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   ├── users.repository.ts
│       │   ├── users.service.spec.ts
│       │   ├── users.repository.integration.spec.ts
│       │   ├── dto/
│       │   │   ├── create-user.dto.ts
│       │   │   └── update-user.dto.ts
│       │   ├── entities/
│       │   │   └── user.entity.ts
│       │   └── interfaces/
│       │       └── user.interface.ts
│       │
│       ├── auctions/                         # Auctions module
│       │   ├── auctions.module.ts
│       │   ├── auctions.controller.ts
│       │   ├── auctions.service.ts
│       │   ├── auctions.repository.ts
│       │   ├── auctions.service.spec.ts
│       │   ├── auctions.repository.integration.spec.ts
│       │   ├── dto/
│       │   │   ├── create-auction.dto.ts
│       │   │   └── update-auction.dto.ts
│       │   ├── entities/
│       │   │   └── auction.entity.ts
│       │   ├── interfaces/
│       │   │   └── auction.interface.ts
│       │   ├── handlers/
│       │   │   ├── auction-closed.handler.ts
│       │   │   └── payment-window-expired.handler.ts
│       │   └── processors/
│       │       ├── auction-close.processor.ts
│       │       └── payment-window.processor.ts
│       │
│       └── bids/                             # Bids module
│           ├── bids.module.ts
│           ├── bids.controller.ts
│           ├── bids.service.ts
│           ├── bids.repository.ts
│           ├── bids.service.spec.ts
│           ├── bids.repository.integration.spec.ts
│           ├── dto/
│           │   ├── create-bid.dto.ts
│           │   └── bid-response.dto.ts
│           ├── entities/
│           │   └── bid.entity.ts
│           └── interfaces/
│               └── bid.interface.ts
│
├── test/                                     # E2E tests and shared test utilities
│   ├── helpers/
│   │   ├── db.helper.ts                      # DB reset, seed, teardown for tests
│   │   └── auth.helper.ts                    # Token generation for test requests
│   ├── factories/
│   │   ├── user.factory.ts
│   │   ├── auction.factory.ts
│   │   └── bid.factory.ts
│   ├── bids.e2e.spec.ts
│   ├── auctions.e2e.spec.ts
│   └── auth.e2e.spec.ts
│
├── dist/                                     # Build output — never commit
├── node_modules/                             # Never commit
│
├── .env.development                          # Safe defaults — committed
├── .env.test                                 # Test DB config — committed
├── .env.staging                              # Never committed — lives on VPS only
├── .env.production                           # Never committed — lives on VPS only
├── .env.example                              # Template for all env vars — committed
│
├── .eslintrc.js                              # ESLint config
├── .prettierrc                               # Prettier config
├── jest.config.ts                            # Jest config (unit/integration/e2e projects)
├── tsconfig.json                             # TypeScript config
├── tsconfig.build.json                       # Build-specific TS config (excludes tests)
├── ecosystem.config.js                       # PM2 config (staging + production)
├── nest-cli.json                             # NestJS CLI config
└── package.json

---

## File Responsibility Rules

### `main.ts` — Entry Point Only
- Bootstrap the NestJS app
- Register global pipes, filters, interceptors, guards
- Set API prefix and versioning
- Enable Swagger (non-production only)
- Set up nestjs-cls middleware
- Start listening on configured port
- Nothing else — no business logic ever

### `app.module.ts` — Root Module Only
- Import all feature modules
- Import ConfigModule (global)
- Import TypeOrmModule (global)
- Import ThrottlerModule (global)
- Import EventEmitterModule (global)
- Import ClsModule (global)
- Nothing else — no providers, no controllers directly

### `app.controller.ts` — Health Check Only
- Single GET /api/v1/health endpoint
- Returns app status, version, env, uptime, DB ping
- Must be @Public() — no auth required
- No other endpoints ever

---

## Module Internal Structure Rules

Every feature module must follow this exact internal structure:
<name>/
├── <name>.module.ts          # REQUIRED — module definition
├── <name>.controller.ts      # REQUIRED — HTTP layer only
├── <name>.service.ts         # REQUIRED — business logic only
├── <name>.repository.ts      # REQUIRED — DB access only
├── <name>.service.spec.ts    # REQUIRED — unit tests for service
├── <name>.repository.        # REQUIRED — integration tests
│   integration.spec.ts
├── dto/                      # REQUIRED — always present
│   ├── create-<name>.dto.ts
│   └── update-<name>.dto.ts
├── entities/                 # REQUIRED if module has DB table
│   └── <name>.entity.ts
├── interfaces/               # REQUIRED — domain contracts
│   └── <name>.interface.ts
├── handlers/                 # OPTIONAL — only if async events exist
│   └── <event>.handler.ts
└── processors/               # OPTIONAL — only if queue jobs exist
└── <job>.processor.ts

---

## Naming Rules — File System

| What | Convention | Example |
|---|---|---|
| All files | kebab-case | `bid-response.dto.ts` |
| Module files | `<name>.module.ts` | `bids.module.ts` |
| Controller files | `<name>.controller.ts` | `bids.controller.ts` |
| Service files | `<name>.service.ts` | `bids.service.ts` |
| Repository files | `<name>.repository.ts` | `bids.repository.ts` |
| Entity files | `<name>.entity.ts` | `bid.entity.ts` |
| DTO files | `<action>-<name>.dto.ts` | `create-bid.dto.ts` |
| Interface files | `<name>.interface.ts` | `bid.interface.ts` |
| Unit test files | `<name>.service.spec.ts` | `bids.service.spec.ts` |
| Integration tests | `<name>.repository.integration.spec.ts` | `bids.repository.integration.spec.ts` |
| E2E test files | `<name>.e2e.spec.ts` | `bids.e2e.spec.ts` |
| Handler files | `<event>.handler.ts` | `auction-closed.handler.ts` |
| Processor files | `<job>.processor.ts` | `auction-close.processor.ts` |
| Migration files | `<timestamp>-<PascalName>.ts` | `1714000000000-CreateBidsTable.ts` |
| Seed logic files | `<name>.seed.ts` | `categories.seed.ts` |
| Seed data files | `<name>.data.ts` | `categories.data.ts` |
| Seed runner files | `<name>-runner.ts` | `categories-runner.ts` |
| Factory files | `<name>.factory.ts` | `bid.factory.ts` |

---

## Import Path Aliases

Always use path aliases — never relative `../../` imports.
Defined in `tsconfig.json` paths:

```typescript
// ✅ Correct
import { BidsService } from '@modules/bids/bids.service';
import { BaseEntity } from '@common/entities/base.entity';
import { Permission } from '@common/enums/permission.enum';
import { AppConfig } from '@config/app.config';

// ❌ Wrong
import { BidsService } from '../../bids/bids.service';
import { BaseEntity } from '../../../common/entities/base.entity';
```

Alias mapping:
```json
{
  "@common/*": ["src/common/*"],
  "@config/*": ["src/config/*"],
  "@modules/*": ["src/modules/*"],
  "@database/*": ["src/database/*"],
  "@test/*":   ["test/*"]
}
```

---

## What Goes Where — Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|---|---|
| Business logic in controller | Move to service |
| DB query in service | Move to repository |
| Shared utility in a feature module | Move to `common/utils/` |
| Exception class in a feature module | Move to `common/exceptions/` |
| Event name as raw string | Use constant from `common/events/event-names.ts` |
| process.env in a feature file | Use ConfigService from `@config/` |
| console.log anywhere | Use logger from LoggerModule |
| Cross-module direct import | Extract to `common/` first |
| Test factory inside spec file | Move to `test/factories/` |
| E2E test in `src/` | Move to `test/` |
| Migration in `src/` | Move to `src/database/migrations/` |
| Seed in `src/modules/` | Move to `src/database/seeds/` |