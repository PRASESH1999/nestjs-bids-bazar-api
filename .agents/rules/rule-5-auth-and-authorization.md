---
trigger: always_on
---

# Rule 5: Auth & Authorization

## Authentication Strategy
- Primary: JWT with access token + refresh token (built in-house via @nestjs/jwt + passport).
- Social login (OAuth2) is planned for future — design auth layer to be provider-agnostic
  from day one. Use an auth strategy pattern so new providers can be plugged in without
  restructuring core auth logic.
- All auth logic lives exclusively in a dedicated auth/ module — never scattered across
  feature modules.

## Token Design
### Access Token
- Short-lived: 15 minutes expiry.
- Payload must include:
    sub       : user UUID
    email     : user email
    roles     : string[] (e.g. ['BIDDER', 'AUCTIONEER'])
    permissions: string[] (e.g. ['bid:create', 'auction:close'])
- Signed with RS256 (asymmetric) — never HS256 in staging or production.
- Never store sensitive data in the token payload (no passwords, no payment info).

### Refresh Token
- Long-lived: 7 days expiry.
- Stored in the database (hashed) — never in-memory only.
- Refresh token rotation: every use issues a new refresh token and invalidates the old one.
- Refresh tokens are invalidated immediately on:
    Logout
    Password change
    Account suspension
    Detection of reuse of an already-used refresh token (treat as breach)

## Token Storage & Transport
- Access token: sent via Authorization header as Bearer token — never in cookies or
  query params.
- Refresh token: sent via HttpOnly, Secure, SameSite=Strict cookie — never in
  response body.
- Never log tokens anywhere — not in application logs, not in error traces.

## Roles
Define as a TypeScript enum in common/enums/role.enum.ts:

enum Role {
  BIDDER      = 'BIDDER',       // Can place bids, view auctions
  AUCTIONEER  = 'AUCTIONEER',   // Can create and manage auctions
  ADMIN       = 'ADMIN',        // Full system access
}

- A user can hold multiple roles simultaneously (e.g. BIDDER + AUCTIONEER).
- Role assignment is managed by ADMIN only.
- Roles are stored in the users table and embedded in the JWT payload on login.

## Permissions
Define granular permissions as constants in common/enums/permission.enum.ts:

enum Permission {
  // Bid permissions
  BID_CREATE        = 'bid:create',
  BID_VIEW          = 'bid:view',

  // Auction permissions
  AUCTION_CREATE    = 'auction:create',
  AUCTION_VIEW      = 'auction:view',
  AUCTION_CLOSE     = 'auction:close',
  AUCTION_CANCEL    = 'auction:cancel',

  // Admin permissions
  USER_MANAGE       = 'user:manage',
  ROLE_ASSIGN       = 'role:assign',
  SYSTEM_CONFIG     = 'system:config',
}

## Role → Permission Mapping
- Permissions are derived from roles — never assigned individually to users directly.
- Mapping defined centrally in auth/role-permissions.map.ts:

  BIDDER      → [BID_CREATE, BID_VIEW, AUCTION_VIEW]
  AUCTIONEER  → [AUCTION_CREATE, AUCTION_VIEW, AUCTION_CLOSE, AUCTION_CANCEL, BID_VIEW]
  ADMIN       → All permissions

## Guards
- Implement two guards in common/guards/:
    JwtAuthGuard     : Validates access token, attaches user to request
    PermissionsGuard : Checks user permissions against required permissions on route

- Apply JwtAuthGuard globally in app.module.ts — all routes are protected by default.
- Use @Public() decorator to explicitly opt out on public routes (e.g. login, register,
  view auction listings).
- Use @RequirePermissions() decorator to declare required permissions per route.

Example usage:
  @Public()
  @Get('auctions')               // Anyone can view auctions
  findAll() {}

  @RequirePermissions(Permission.BID_CREATE)
  @Post('bids')                  // Only users with bid:create permission
  placeBid() {}

  @RequirePermissions(Permission.AUCTION_CLOSE)
  @Patch('auctions/:id/close')   // Only AUCTIONEER or ADMIN
  closeAuction() {}

## Endpoint Access Matrix
| Endpoint                        | Public | BIDDER | AUCTIONEER | ADMIN |
|---------------------------------|--------|--------|------------|-------|
| GET  /auctions                  | ✅     | ✅     | ✅         | ✅    |
| GET  /auctions/:id              | ✅     | ✅     | ✅         | ✅    |
| POST /auctions                  | ❌     | ❌     | ✅         | ✅    |
| PATCH /auctions/:id/close       | ❌     | ❌     | ✅ (own)   | ✅    |
| POST /bids                      | ❌     | ✅     | ❌         | ✅    |
| GET  /bids                      | ❌     | ✅     | ✅         | ✅    |
| POST /auth/login                | ✅     | ✅     | ✅         | ✅    |
| POST /auth/register             | ✅     | ✅     | ✅         | ✅    |
| POST /auth/refresh              | ✅     | ✅     | ✅         | ✅    |
| POST /auth/logout               | ❌     | ✅     | ✅         | ✅    |

## Ownership Rules
- An AUCTIONEER can only close or cancel their own auctions — not others'.
- A BIDDER can only view their own bid history — not other bidders'.
- ADMIN bypasses all ownership checks.
- Ownership checks are enforced in the service layer — never in the controller.

## Social Login (Future-Proofing)
- Auth module must use a strategy pattern (passport strategies) so OAuth2 providers
  can be added without restructuring.
- When social login is added, it must issue the same JWT access + refresh token pair
  as in-house login — no separate session handling.
- Map social provider identity to an internal user record on first login (auto-register).
- [DECISION NEEDED]: Which OAuth2 providers to support first?
  (e.g. Google, GitHub, Facebook)

## Security Rules
- Passwords hashed with bcrypt, minimum 12 salt rounds.
- Rate limit auth endpoints:
    POST /auth/login    : 5 attempts per 15 minutes per IP
    POST /auth/register : 10 attempts per hour per IP
    POST /auth/refresh  : 20 attempts per 15 minutes per IP
- Lock account after 10 consecutive failed login attempts — require email