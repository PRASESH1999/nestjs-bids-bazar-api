# Dependencies Reference

> This is the canonical package list for the Bids Bazzar project.
> Never install a package not listed here without asking the user first.
> Always use exact versions listed — do not upgrade without explicit approval.

---

## Install All Core Dependencies

### Production Dependencies
```bash
npm install \
  @nestjs/common @nestjs/core @nestjs/platform-express \
  @nestjs/config \
  @nestjs/typeorm typeorm pg \
  @nestjs/jwt @nestjs/passport passport passport-jwt \
  @nestjs/swagger swagger-ui-express \
  @nestjs/throttler \
  @nestjs/event-emitter \
  class-validator class-transformer \
  nestjs-cls \
  nestjs-pino pino-http pino-pretty \
  helmet compression \
  bcrypt \
  uuid \
  joi \
  reflect-metadata rxjs
```

### Development Dependencies
```bash
npm install --save-dev \
  @nestjs/cli @nestjs/schematics \
  @nestjs/testing \
  @types/node @types/express \
  @types/passport-jwt \
  @types/bcrypt \
  @types/uuid \
  @types/compression \
  typescript ts-node ts-jest \
  jest @types/jest \
  @faker-js/faker \
  eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-import \
  prettier eslint-config-prettier eslint-plugin-prettier \
  husky lint-staged \
  supertest @types/supertest
```

---

## Full Package Reference

### Core NestJS
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/common` | ^10.0.0 | Core decorators, pipes, guards, interceptors |
| `@nestjs/core` | ^10.0.0 | NestJS application core |
| `@nestjs/platform-express` | ^10.0.0 | Express HTTP adapter |
| `@nestjs/cli` | ^10.0.0 | CLI for generating modules, services, etc. |
| `@nestjs/schematics` | ^10.0.0 | Code generation schematics |
| `reflect-metadata` | ^0.1.13 | Required for decorators |
| `rxjs` | ^7.8.0 | Required by NestJS core |

### Database
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/typeorm` | ^10.0.0 | NestJS TypeORM integration |
| `typeorm` | ^0.3.0 | ORM — all DB access |
| `pg` | ^8.11.0 | PostgreSQL driver |

### Authentication
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/jwt` | ^10.0.0 | JWT signing and verification |
| `@nestjs/passport` | ^10.0.0 | NestJS Passport integration |
| `passport` | ^0.6.0 | Auth middleware |
| `passport-jwt` | ^4.0.1 | JWT Passport strategy |
| `bcrypt` | ^5.1.0 | Password hashing (min 12 rounds) |
| `@types/bcrypt` | ^5.0.0 | TypeScript types for bcrypt |
| `@types/passport-jwt` | ^4.0.0 | TypeScript types for passport-jwt |

### Configuration & Validation
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/config` | ^3.0.0 | Environment config module |
| `joi` | ^17.11.0 | Env var validation schema at startup |
| `class-validator` | ^0.14.0 | DTO field validation decorators |
| `class-transformer` | ^0.5.1 | DTO transformation (query params, nested) |

### API Documentation
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/swagger` | ^7.0.0 | OpenAPI/Swagger documentation |
| `swagger-ui-express` | ^5.0.0 | Swagger UI serving |

### Security & Performance
| Package | Version | Purpose |
|---|---|---|
| `helmet` | ^7.0.0 | HTTP security headers |
| `compression` | ^1.7.4 | Gzip response compression |
| `@nestjs/throttler` | ^5.0.0 | Rate limiting |
| `@types/compression` | ^1.7.4 | TypeScript types for compression |

### Request Context
| Package | Version | Purpose |
|---|---|---|
| `nestjs-cls` | ^4.0.0 | Request-scoped context (correlation ID, user) |

### Events & Queues
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/event-emitter` | ^2.0.0 | In-process event emitter (interim) |

> ⚠️ When queue system is decided (BullMQ / RabbitMQ / Kafka),
> add the relevant package here before installing.
> [DECISION NEEDED] — See Open Decisions Log in SKILL.md

### Logging
| Package | Version | Purpose |
|---|---|---|
| `nestjs-pino` | ^4.0.0 | NestJS Pino integration (recommended) |
| `pino-http` | ^9.0.0 | HTTP request logging via Pino |
| `pino-pretty` | ^11.0.0 | Human-readable logs in development |

> ⚠️ If Winston is chosen over Pino, replace with:
> `nest-winston` + `winston` + `winston-daily-rotate-file`
> [DECISION NEEDED] — See Open Decisions Log in SKILL.md

### Testing
| Package | Version | Purpose |
|---|---|---|
| `@nestjs/testing` | ^10.0.0 | NestJS test module utilities |
| `jest` | ^29.0.0 | Test runner |
| `ts-jest` | ^29.0.0 | TypeScript support for Jest |
| `@types/jest` | ^29.0.0 | TypeScript types for Jest |
| `@faker-js/faker` | ^8.0.0 | Test data generation — all factories |
| `supertest` | ^6.3.0 | HTTP assertion for e2e tests |
| `@types/supertest` | ^6.0.0 | TypeScript types for supertest |

### Code Quality
| Package | Version | Purpose |
|---|---|---|
| `eslint` | ^8.0.0 | Linting |
| `@typescript-eslint/parser` | ^6.0.0 | TypeScript ESLint parser |
| `@typescript-eslint/eslint-plugin` | ^6.0.0 | TypeScript ESLint rules |
| `eslint-plugin-import` | ^2.29.0 | Import ordering and validation |
| `prettier` | ^3.0.0 | Code formatting |
| `eslint-config-prettier` | ^9.0.0 | Disable ESLint rules that conflict with Prettier |
| `eslint-plugin-prettier` | ^5.0.0 | Run Prettier as ESLint rule |
| `husky` | ^9.0.0 | Git hooks |
| `lint-staged` | ^15.0.0 | Run linters on staged files only |

### Utilities
| Package | Version | Purpose |
|---|---|---|
| `uuid` | ^9.0.0 | UUID generation where needed outside TypeORM |
| `@types/uuid` | ^9.0.0 | TypeScript types for uuid |
| `@types/node` | ^20.0.0 | Node.js TypeScript types |
| `@types/express` | ^4.17.0 | Express TypeScript types |

---

## Future Packages — Add When Decisions Are Made

### When Queue System is Decided
```bash
# Option A — BullMQ (recommended)
npm install @nestjs/bullmq bullmq
npm install --save-dev @types/bull

# Option B — RabbitMQ
npm install @nestjs/microservices amqplib amqp-connection-manager
npm install --save-dev @types/amqplib

# Option C — Kafka
npm install @nestjs/microservices kafkajs
```

### When Social Login is Added
```bash
# Google OAuth2
npm install passport-google-oauth20
npm install --save-dev @types/passport-google-oauth20

# GitHub OAuth2
npm install passport-github2
npm install --save-dev @types/passport-github2
```

### When Audit Logging is Decided
```bash
# If full diff audit logging chosen
npm install microdiff
```

### When Metrics/Observability is Added
```bash
# Prometheus metrics
npm install @willsoto/nestjs-prometheus prom-client
```

---

## NPM Scripts
Add these to `package.json` scripts — all must be present:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:staging": "NODE_ENV=staging node dist/main",
    "start:prod": "NODE_ENV=production node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "test": "jest --projects=unit",
    "test:integration": "jest --projects=integration",
    "test:e2e": "jest --projects=e2e",
    "test:cov": "jest --coverage",
    "test:all": "jest",
    "migration:generate": "typeorm migration:generate",
    "migration:run": "typeorm migration:run -d dist/config/ormconfig.js",
    "migration:revert": "typeorm migration:revert -d dist/config/ormconfig.js",
    "seed:run": "ts-node database/seeds/index.ts",
    "seed:staging": "NODE_ENV=staging ts-node database/seeds/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## Husky & lint-staged Setup

```bash
# Initialize husky
npx husky init
```

```json
// package.json — add this section
{
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npm run lint-staged

# .husky/commit-msg
npx --no -- commitlint --edit $1

# .husky/pre-push
npm run test
npm run typecheck
```

---

## Package Rules
- Never install a package not on this list without explicit user approval.
- Never upgrade a package version without explicit user approval.
- Always use `npm ci` in staging and production — never `npm install`.
- Always use `--save-dev` for dev dependencies — never mix into production deps.
- After adding any package → update this file immediately.
- After adding any package → run `npm run build` to verify no conflicts.