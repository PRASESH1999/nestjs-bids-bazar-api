---
trigger: always_on
---

# Rule 10: Environment & Deployment

## Environments
Three environments — all must be explicitly supported from day one:

  development : Local machine — active development and unit testing
  staging     : VPS (inactive for now, activate when ready) — mirrors production exactly,
                used for testing auction timers, payment windows, and migrations safely
  production  : VPS — live users, real data, zero tolerance for errors

NODE_ENV must always be set to one of: development | staging | production
Never run production code without NODE_ENV explicitly set.

## Environment Variables
- All configuration loaded exclusively via NestJS ConfigModule with Joi or Zod validation.
- App must fail fast on startup if any required env variable is missing or invalid —
  never start with incomplete config.
- Every environment has its own .env file — never shared:
    .env.development    → local dev (committed to repo with safe defaults only)
    .env.staging        → staging VPS (never committed — stored on server)
    .env.production     → production VPS (never committed — stored on server)
    .env.test           → test database and config (committed, safe values only)
- .env.staging and .env.production are never committed to the repository — ever.
- Add all .env.* files except .env.development and .env.test to .gitignore.

## Required Environment Variables
All of the following must be present and validated at startup:

# App
NODE_ENV                    # development | staging | production
PORT                        # default 3000
API_PREFIX                  # default 'api'
API_VERSION                 # default 'v1'

# Database
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_SSL                      # false in development, true in staging + production
DB_POOL_MIN                 # default 2
DB_POOL_MAX                 # default 10

# Auth
JWT_ACCESS_SECRET           # RS256 private key (asymmetric)
JWT_ACCESS_EXPIRY           # default '15m'
JWT_REFRESH_SECRET          # RS256 private key (asymmetric)
JWT_REFRESH_EXPIRY          # default '7d'

# Bidding Domain
PAYMENT_WINDOW_HOURS        # fixed 18 — do not change without a rule update
AUCTION_DURATION_HOURS      # default auction duration [DECISION NEEDED]
MIN_BID_INCREMENT           # [DECISION NEEDED]

# Rate Limiting
RATE_LIMIT_TTL              # default 60000 (ms)
RATE_LIMIT_MAX              # default 100 requests per TTL

# Logging
LOG_LEVEL                   # debug | info | warn | error

# [DECISION NEEDED] Queue (add when queue system is decided)
# REDIS_HOST
# REDIS_PORT
# REDIS_PASSWORD

# [DECISION NEEDED] OAuth (add when social login is implemented)
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET

## PM2 Setup (Production & Staging)
- Use PM2 as the process manager on the VPS for both staging and production.
- PM2 config lives in ecosystem.config.js at the project root — never inline CLI flags.
- Separate PM2 app entries for staging and production:

// ecosystem.config.js
module.exports = {
  apps: [
    {
      name        : 'bids-bazar-api-production',
      script      : 'dist/main.js',
      instances   : 'max',          // use all available CPU cores
      exec_mode   : 'cluster',      // cluster mode for load balancing
      env_production: {
        NODE_ENV  : 'production',
        PORT      : 3000,
      },
    },
    {
      name        : 'bids-bazar-api-staging',
      script      : 'dist/main.js',
      instances   : 1,              // single instance on staging is fine
      exec_mode   : 'fork',
      env_staging: {
        NODE_ENV  : 'staging',
        PORT      : 3001,           // different port from production on same VPS
      },
    },
  ],
};

- Always run the built dist/ — never run ts-node in staging or production.
- Enable PM2 startup script so app restarts automatically on VPS reboot:
    pm2 startup
    pm2 save

## Build Rules
- Always build before deploying: npm run build
- Build output goes to dist/ — never commit dist/ to the repository.
- Add dist/ to .gitignore.
- TypeScript must compile with zero errors before any deployment — never deploy a
  broken build.
- Run database migrations immediately after build and before app starts:
    npm run migration:run
  This order is mandatory: build → migrate → start

## Deployment Process (Manual — until CI/CD is added)
Follow this exact sequence every deployment — no shortcuts:

  Step 1 — On local machine:
    git pull origin main
    npm ci                        # clean install — never npm install in production
    npm run lint                  # must pass with zero errors
    npm run test                  # unit tests must pass
    npm run build                 # must compile with zero errors

  Step 2 — On VPS (staging first, then production):
    git pull origin main
    npm ci --omit=dev             # production dependencies only
    npm run migration:run         # run pending migrations
    pm2 reload ecosystem.config.js --env production  # zero-downtime reload

  Step 3 — Verify after deployment:
    pm2 status                    # all instances must be online
    pm2 logs --lines 50           # check for startup errors
    curl https://yourdomain/api/v1/health  # health check must return 200

- Never deploy directly to production without verifying on staging first
  (once staging is active).
- Always keep the previous build accessible for quick rollback:
    Keep last 2 releases in ~/releases/ on the VPS
    Symlink current/ to the active release
    Rollback: pm2 reload with previous release

## Health Check Endpoint
- Implement GET /api/v1/health as a @Public() endpoint.
- Must return 200 with system status — used for deployment verification and
  uptime monitoring:

{
  "data": {
    "status"   : "ok",
    "version"  : "1.0.0",
    "env"      : "production",
    "uptime"   : 3600,
    "db"       : "ok"         // result of a lightweight DB ping
  },
  "meta": null,
  "error": null
}

- DB ping must be a lightweight query (SELECT 1) — not a full table scan.
- If DB ping fails, return 503 with status "degraded".

## CI/CD (Future — not active yet)
When you are ready to add CI/CD, implement GitHub Actions with this pipeline:

  On pull request  → lint + unit tests + integration tests
  On merge to main → full test suite + build + deploy to staging automatically
  On release tag   → deploy to production after manual approval gate

Until CI/CD is active: follow the manual deployment process above strictly.

## Security Rules for VPS
- Never run the app as root on the VPS — create a dedicated non-root user.
- Firewall rules: only ports 80, 443, and 22 open externally.
- App listens on internal port (3000/3001) — Nginx reverse proxies to it.
- SSL/TLS termination at Nginx level — app never handles SSL directly.
- Keep Node.js, PM2, and system packages updated — schedule monthly updates.
- [DECISION NEEDED]: Set up basic uptime monitoring
  (e.g. UptimeRobot — free tier pings your health endpoint every 5 minutes)

## Nginx Configuration Rules
- Nginx acts as reverse proxy in front of PM2.
- Separate Nginx server blocks for staging and production.
- Always set these headers in Nginx:
    X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    X-XSS-Protection: 1; mode=block
    Strict-Transport-Security: max-age=31536000
- Enable gzip compression for JSON responses in Nginx config.
- Set client_max_body_size to a reasonable limit (e.g. 1MB for a bids bazar api).

## What is Different Per Environment
| Setting                  | development      | staging          | production       |
|--------------------------|------------------|------------------|------------------|
| DB_SSL                   | false            | true             | true             |
| LOG_LEVEL                | debug            | info             | warn             |
| PM2 instances            | N/A (local)      | 1                | max (all cores)  |
| Swagger UI               | enabled          | enabled          | disabled         |
| Stack traces in errors   | enabled          | enabled          | disabled         |
| PORT                     | 3000             | 3001             | 3000             |
| Migration auto-run       | manual           | manual           | manual (step 2)  |