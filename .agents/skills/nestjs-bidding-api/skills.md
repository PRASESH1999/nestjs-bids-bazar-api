---
name: NestJS Bids Bazzar — Standards & Patterns
description: >
  Use this skill for every task in the Bids Bazzar project. Covers project
  structure, TypeORM patterns, authentication, bidding domain logic, error
  handling, events, testing, logging, and all coding conventions. Always read
  this skill before writing any NestJS code, creating any module, scaffolding
  any file, or making any architectural decision. Applies to all features:
  bids, auctions, auth, payments, users, and any future modules.
---

# NestJS Bids Bazzar — Master Skill

> **MANDATORY**: Read this entire file before writing any code. Then read the
> relevant reference files listed in Section 4 before proceeding with the task.
> This document is the source of truth for all architectural and coding decisions.

---

## 1. Project Context

| Property        | Value                                              |
|-----------------|----------------------------------------------------|
| Project         | Bids Bazzar                                        |
| Domain          | English auction platform (highest bid wins)        |
| Framework       | NestJS + TypeScript (strict mode)                  |
| Database        | PostgreSQL via TypeORM                             |
| Architecture    | Modular / Feature-based (single service)           |
| Auth            | JWT (access + refresh) + Roles + Permissions       |
| Deployment      | VPS via PM2 (dev → staging → production)           |
| Request Context | nestjs-cls (correlation ID propagation)            |
| Test Stack      | Jest + ts-jest (unit + integration + e2e)          |
| API Style       | REST only, versioned at /api/v1/                   |
| Response Format | Always { data, meta, error } envelope              |

### Core Domain Summary
- English auction: highest bid wins
- Auction closes X hours after the first bid is placed
- Payment window: 18 hours after auction closes
- If winner fails to pay → fallback to next highest bidder
- If all bidders fail → auction moves to ABANDONED

### Key State Machines
Bid:     DRAFT → SUBMITTED → ACCEPTED | REJECTED
Auction: PENDING → ACTIVE → CLOSED → AWAITING_PAYMENT
         → SETTLED | PAYMENT_FAILED | ABANDONED

---

## 2. Project Stack & Libraries

| Layer           | Technology                                      |
|-----------------|-------------------------------------------------|
| Runtime         | Node.js 20+                                     |
| Framework       | NestJS with TypeScript strict mode              |
| Database        | PostgreSQL via TypeORM                          |
| Validation      | class-validator + class-transformer             |
| Auth            | @nestjs/passport + passport-jwt + @nestjs/jwt   |
| Config          | @nestjs/config with Joi validation schema       |
| Docs            | @nestjs/swagger                                 |
| Security        | helmet + @nestjs/throttler                      |
| Compression     | compression                                     |
| Logging         | Pino via nestjs-pino OR Winston via nest-winston |
| Request Context | nestjs-cls                                      |
| Testing         | Jest + ts-jest + @faker-js/faker                |
| Process Manager | PM2                                             |

> See references/dependencies.md for the full package list with exact
> versions and install commands.

---

## 3. Quick Reference — Where Does X Go?

Use this table to immediately know where any piece of code belongs.
Never place code in the wrong layer — this is enforced by Rule 1.

| What                              | Where                                      |
|-----------------------------------|--------------------------------------------|
| HTTP handling, route definitions  | Controller (`*.controller.ts`)             |
| Business logic, domain rules      | Service (`*.service.ts`)                   |
| Database queries                  | Repository (`*.repository.ts`)             |
| Request/response shape            | DTO (`dto/*.dto.ts`)                       |
| Database model                    | Entity (`entities/*.entity.ts`)            |
| Domain contract/shape             | Interface (`interfaces/*.interface.ts`)    |
| Shared utilities                  | `common/utils/`                            |
| Shared decorators                 | `common/decorators/`                       |
| Shared guards                     | `common/guards/`                           |
| Shared interceptors               | `common/interceptors/`                     |
| Shared pipes                      | `common/pipes/`                            |
| Shared exception classes          | `common/exceptions/`                       |
| All error codes registry          | `common/exceptions/error-codes.ts`         |
| Auth logic (JWT, strategy)        | `modules/auth/`                            |
| Role/permission definitions       | `common/enums/`                            |
| Environment config                | `config/`                                  |
| Database migrations               | `database/migrations/`                     |
| Database seed files               | `database/seeds/`                          |
| Event name constants              | `common/events/event-names.ts`             |
| Event handlers                    | `modules/<name>/handlers/`                 |
| Queue job processors              | `modules/<name>/processors/`               |
| Global app setup                  | `main.ts`                                  |
| Test factories                    | `test/factories/`                          |
| Test helpers                      | `test/helpers/`                            |
| E2E tests                         | `test/*.e2e.spec.ts`                       |
| Unit + integration tests          | Co-located with source file                |

---

## 4. Reference Index

Read the relevant reference file BEFORE writing any code for that topic.
Do not rely on memory — always read the reference fresh.

### 🔴 Priority 1 — Always Read First
These apply to every single task regardless of what you are building.

| Reference | Read When |
|---|---|
| [references/conventions.md] | Before naming any file, class, variable, or DB column |
| [references/project-structure.md] | Before creating any file or folder |
| [references/bootstrap.md] | Before touching main.ts, global pipes, interceptors, or filters |
| [references/environment.md] | Before adding any env variable or config value |
| [references/dependencies.md] | Before installing any package |

### 🟡 Priority 2 — Read Before Writing Features
Read the specific reference that matches your current task.

| Reference | Read When |
|---|---|
| [references/typeorm-patterns.md] | Before writing any entity, repository, query, or migration |
| [references/auth.md] | Before touching auth module, JWT, tokens, or strategies |
| [references/rbac.md] | Before adding any guard, role, permission, or protected route |
| [references/error-handling.md] | Before throwing any exception or adding error handling |
| [references/response-standards.md] | Before writing any controller response or interceptor |
| [references/bidding-domain.md] | Before writing any bid or auction business logic |
| [references/cls-context.md] | Before using request context, correlation ID, or user context |
| [references/events-queues.md] | Before writing any event, job, or async operation |
| [references/logging.md] | Before adding any log statement anywhere |

### 🟢 Priority 3 — Read As Needed

| Reference | Read When |
|---|---|
| [references/swagger-standards.md] | Before adding any Swagger decorator |
| [references/testing-standards.md] | Before writing any test (unit, integration, or e2e) |
| [references/seeds.md] | Before writing any seed file |
| [references/audit-log.md] | When audit logging decision is finalized — placeholder for now |

---

## 5. Agent Behavior Rules

These are non-negotiable. Follow them on every single task.

### Before Writing Any Code
- Read this master SKILL.md fully — always, not just the first time.
- Read every Priority 1 reference.
- Read the specific Priority 2 reference(s) that match the task.
- Never invent patterns not defined in the reference files.
- Never use a package not listed in references/dependencies.md without
  asking the user first.
- When in doubt about where code belongs → check Section 3 of this file.
- When in doubt about a pattern → read the reference, do not guess.

### While Writing Code
- TypeScript strict mode always — no `any`, no implicit types, ever.
- All functions must have explicit return types.
- All promises must be awaited or explicitly handled.
- Never use console.log — always use the project logger (references/logging.md).
- Never access process.env directly — always use ConfigService (references/environment.md).
- Never skip a layer — controller → service → repository, always.
- Never put business logic in controllers or repositories.
- Never put DB queries in services.
- **Strict SRP**: Services must never use inherited ORM methods; all DB operations must be called via custom Repository methods.
- **Wrapper Pattern**: Repositories must use composition (`private readonly repo`) instead of inheritance.
- Always use the standard response envelope (references/response-standards.md).
- Always throw domain exceptions, never raw HTTP exceptions (references/error-handling.md).
- Always use nestjs-cls for request context access (references/cls-context.md).

### After Writing Any Code
- Run the Pre-Commit Quality Checklist in Section 6.
- Never consider a task done until the checklist passes fully.
- If lint or build fails → fix immediately, never leave broken.

### When Ambiguous
- If the task is unclear → ask the user before writing code.
- If a decision is marked [DECISION NEEDED] in any rule or reference →
  surface it to the user, do not make the decision autonomously.
- If two references seem to conflict → flag it to the user immediately.

---

## 6. Pre-Commit Quality Checklist

Run this checklist at the end of EVERY task before marking it done.
Every item must pass — no exceptions.

### TypeScript & Code Quality
- [ ] No `any` types anywhere in new or modified code
- [ ] All functions have explicit return types
- [ ] All promises are awaited or handled
- [ ] No unused variables, imports, or parameters
- [ ] No console.log, console.error, or console.warn
- [ ] No process.env access outside config/
- [ ] No hardcoded secrets, URLs, or magic numbers

### Architecture
- [ ] No business logic in controllers
- [ ] No DB queries in services
- [ ] No layer skipped (controller → service → repository)
- [ ] **Strict SRP**: Service uses custom repository methods only (no `.save`, `.find`, etc.)
- [ ] **Wrapper Pattern**: Repository uses `private readonly repo` (no `extends Repository`)
- [ ] No cross-module direct imports (shared code extracted to common/)
- [ ] Correct file location per Section 3 of this skill

### API & Response
- [ ] All responses use { data, meta, error } envelope
- [ ] All controller routes have @ApiTags() and @ApiOperation()
- [ ] All DTOs have @ApiProperty() on every field
- [ ] Protected routes have @RequirePermissions() decorator
- [ ] Public routes have @Public() decorator

### Database
- [ ] All entities extend BaseEntity
- [ ] UUIDs used for all primary keys
- [ ] Monetary columns use decimal(18,2) — never float
- [ ] All timestamp columns use 'timestamptz'
- [ ] Foreign key columns have @Index()
- [ ] No synchronize:true anywhere
- [ ] New schema changes have a migration file

### Error Handling
- [ ] Domain exceptions used — never raw HttpException
- [ ] New exception classes registered in error-codes.ts
- [ ] No empty catch blocks
- [ ] No stack traces or internal errors exposed to client

### Testing
- [ ] Unit test file exists for every new service
- [ ] Standard mock pattern used — no improvised mocking
- [ ] Test factories used for all test data — no hardcoded values
- [ ] beforeEach(jest.clearAllMocks) present in every test file
- [ ] No real DB calls in unit tests

### Logging
- [ ] Critical domain events logged at info level
- [ ] No sensitive data in any log statement
- [ ] All log statements use structured format with relevant fields
- [ ] nestjs-cls correlation ID present in all log context

### Final Gates (Mandatory — must pass before done)
- [ ] npm run lint → zero errors, zero warnings
- [ ] npm run build → zero TypeScript errors
- [ ] npm run test → all unit tests pass
- [ ] New feature has at least unit tests written

---

## 7. Open Decisions Log

Track unresolved decisions here. Do not build around these without
surfacing them to the user first.

| # | Decision | Impact |
|---|---|---|
| 1 | Auction duration X (fixed or configurable range) | Rule 3, environment.md |
| 2 | Bid increment approach (fixed, percentage, or none) | Rule 3, bidding-domain.md |
| 3 | Currency/decimal precision | Rule 3, typeorm-patterns.md |
| 4 | Penalty for PAYMENT_DEFAULTED bidders | Rule 3, bidding-domain.md |
| 5 | ABANDONED auction handling | Rule 3, bidding-domain.md |
| 6 | OAuth2 providers (Google, GitHub, etc.) | Rule 5, auth.md |
| 7 | Queue/event system (BullMQ, RabbitMQ, Kafka) | Rule 7, events-queues.md |
| 8 | Real-time broadcasting (WebSockets, SSE, polling) | Rule 7, events-queues.md |
| 9 | Dead-letter alerting mechanism | Rule 7, events-queues.md |
| 10 | Logger choice (Pino recommended vs Winston) | Rule 9, logging.md |
| 11 | External log shipping (Grafana Loki, Logtail) | Rule 9, logging.md |
| 12 | Uptime monitoring tool (UptimeRobot recommended) | Rule 10, environment.md |
| 13 | Audit logging (full diff, basic, or skip) | audit-log.md |