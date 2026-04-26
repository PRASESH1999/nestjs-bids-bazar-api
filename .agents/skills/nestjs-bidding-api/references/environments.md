# Environment Reference

> Read this before adding any environment variable, config value,
> or touching any config file.
> All configuration must flow through ConfigModule + Joi validation.
> App must fail fast on startup if any required variable is missing.

---

## Environment Files

| File | Committed | Purpose |
|---|---|---|
| `.env.example` | ✅ Yes | Template — all vars with safe placeholder values |
| `.env.development` | ✅ Yes | Local dev defaults — no real secrets |
| `.env.test` | ✅ Yes | Test DB config — safe values only |
| `.env.staging` | ❌ Never | Lives on VPS only — real staging secrets |
| `.env.production` | ❌ Never | Lives on VPS only — real production secrets |

### .gitignore Rules
.env.staging
.env.production
dist/
node_modules/

---

## .env.example — Complete Template

```bash
# ─── App ──────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000
API_VERSION=v1
CORS_ORIGIN=*
LOG_LEVEL=debug

# ─── Database ─────────────────────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bids_bazar_api_dev
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10

# ─── Auth ─────────────────────────────────────────────────────────────────────
# RS256 — generate with: openssl genrsa -out private.pem 2048
JWT_ACCESS_SECRET=your-access-private-key-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=your-refresh-private-key-here
JWT_REFRESH_EXPIRY=7d

# ─── Bidding Domain ────────────────────────────────────────────────────────────
PAYMENT_WINDOW_HOURS=18
# [DECISION NEEDED] Set default auction duration
AUCTION_DURATION_HOURS=24
# [DECISION NEEDED] Set bid increment (0 = no increment rule)
MIN_BID_INCREMENT=0

# ─── Rate Limiting ─────────────────────────────────────────────────────────────
RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100

# ─── Queue (Uncomment when queue system is decided) ────────────────────────────
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=

# ─── OAuth (Uncomment when social login is added) ──────────────────────────────
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
```

---

## .env.development

```bash
NODE_ENV=development
PORT=3000
API_VERSION=v1
CORS_ORIGIN=*
LOG_LEVEL=debug

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bids_bazar_api_dev
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=10

JWT_ACCESS_SECRET=dev-access-secret-not-for-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=dev-refresh-secret-not-for-production
JWT_REFRESH_EXPIRY=7d

PAYMENT_WINDOW_HOURS=18
AUCTION_DURATION_HOURS=24
MIN_BID_INCREMENT=0

RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=100
```

---

## .env.test

```bash
NODE_ENV=test
PORT=3001
API_VERSION=v1
LOG_LEVEL=error

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bids_bazar_api_test
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false
DB_POOL_MIN=1
DB_POOL_MAX=5

JWT_ACCESS_SECRET=test-access-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_SECRET=test-refresh-secret
JWT_REFRESH_EXPIRY=7d

PAYMENT_WINDOW_HOURS=18
AUCTION_DURATION_HOURS=24
MIN_BID_INCREMENT=0

RATE_LIMIT_TTL=60000
RATE_LIMIT_MAX=1000
```

---

## Joi Validation Schema

```typescript
// src/config/config.validation.ts
import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // ── App ───────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .required(),
  PORT: Joi.number()
    .integer()
    .min(1024)
    .max(65535)
    .default(3000),
  API_VERSION: Joi.string()
    .default('v1'),
  CORS_ORIGIN: Joi.string()
    .default('*'),
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info'),

  // ── Database ──────────────────────────────────────────────────────────
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MIN: Joi.number().integer().min(1).default(2),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),

  // ── Auth ──────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // ── Bidding Domain ────────────────────────────────────────────────────
  PAYMENT_WINDOW_HOURS: Joi.number()
    .integer()
    .valid(18)           // Fixed at 18 — must not change without rule update
    .default(18),
  AUCTION_DURATION_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(168)            // Max 7 days
    .default(24),
  MIN_BID_INCREMENT: Joi.number()
    .min(0)
    .default(0),         // 0 = no increment rule (Option C)

  // ── Rate Limiting ─────────────────────────────────────────────────────
  RATE_LIMIT_TTL: Joi.number().integer().default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().default(100),

  // ── Queue (Optional — required when queue system decided) ─────────────
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.number().integer().optional(),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

  // ── OAuth (Optional — required when social login added) ───────────────
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  GITHUB_CLIENT_ID: Joi.string().optional(),
  GITHUB_CLIENT_SECRET: Joi.string().optional(),
}).options({
  allowUnknown: false,   // Fail if unknown env vars present
  abortEarly: false,     // Report ALL missing vars at once on startup
});
```

---

## Config Files

### app.config.ts
```typescript
// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiVersion: process.env.API_VERSION ?? 'v1',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
}));
```

### database.config.ts
```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  name: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true',
  poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
  poolMax: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
}));

// Used by TypeOrmModule.forRootAsync in AppModule
export const getDatabaseConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get<string>('database.host'),
  port: config.get<number>('database.port'),
  database: config.get<string>('database.name'),
  username: config.get<string>('database.user'),
  password: config.get<string>('database.password'),
  ssl: config.get<boolean>('database.ssl')
    ? { rejectUnauthorized: false }
    : false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,                    // NEVER true — migrations only
  logging: config.get<string>('app.env') === 'development',
  extra: {
    max: config.get<number>('database.poolMax'),
    min: config.get<number>('database.poolMin'),
  },
});
```

### jwt.config.ts
```typescript
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
}));
```

### throttler.config.ts
```typescript
// src/config/throttler.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('throttler', () => ({
  ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60000', 10),
  limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
}));
```

### ormconfig.ts — TypeORM CLI Only
```typescript
// src/config/ormconfig.ts
// Used exclusively by TypeORM CLI for generating and running migrations
// Never imported by the app itself
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({
  path: `.env.${process.env.NODE_ENV ?? 'development'}`,
});

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
```

---

## Environment Differences Per Environment

| Setting | development | staging | production |
|---|---|---|---|
| `DB_SSL` | false | true | true |
| `LOG_LEVEL` | debug | info | warn |
| `DB_POOL_MAX` | 10 | 10 | 20 |
| `RATE_LIMIT_MAX` | 1000 | 500 | 100 |
| Swagger UI | ✅ Enabled | ✅ Enabled | ❌ Disabled |
| Stack traces | ✅ Exposed | ✅ Exposed | ❌ Never |
| `synchronize` | false | false | false |
| JWT secrets | Dev placeholders | Real RS256 keys | Real RS256 keys |

---

## ConfigService Usage Rules

```typescript
// ✅ Always inject ConfigService and use namespaced keys
@Injectable()
export class ExampleService {
  constructor(private readonly config: ConfigService) {}

  someMethod(): void {
    const paymentWindow = this.config.get<number>(
      'app.paymentWindowHours',
      18,                    // Always provide a default
    );
  }
}

// ❌ Never access process.env directly outside config/
const port = process.env.PORT;           // Wrong — anywhere outside config/
const secret = process.env.JWT_SECRET;  // Wrong — anywhere outside config/

// ❌ Never hardcode values that belong in config
const PAYMENT_WINDOW = 18;              // Wrong — must come from ConfigService
```

---

## Startup Failure Rules
- App MUST crash on startup if any required env var is missing.
- App MUST crash if any env var fails Joi validation.
- App MUST crash if DB connection cannot be established on startup.
- Never start with incomplete or invalid configuration.
- The Joi `abortEarly: false` option ensures ALL missing vars are
  reported at once — not one at a time.

---

## Adding a New Environment Variable — Checklist
When adding any new env var, always do ALL of the following:

  ✅ Add to .env.example with a safe placeholder value
  ✅ Add to .env.development with a dev-safe value
  ✅ Add to .env.test if needed for tests
  ✅ Add to config.validation.ts Joi schema with correct type + default
  ✅ Add to the relevant config file (app.config.ts, jwt.config.ts, etc.)
  ✅ Access via ConfigService only — never process.env in feature code
  ✅ Update this reference file with the new variable
  ✅ Notify team to update .env.staging and .env.production on VPS