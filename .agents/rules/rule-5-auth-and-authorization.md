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
    role      : string (e.g. 'USER', 'ADMIN', 'SUPERADMIN')
    permissions: string[] (e.g. ['item:buy', 'item:sell'])
- Signed with RS256 (asymmetric) using private/public keys — never HS256 in staging or production.
- Never store sensitive data in the token payload (no passwords, no payment info).

### Refresh Token
- Long-lived: 7 days expiry.
- Stored in the database (hashed via bcrypt) — never in-memory only.
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

## Roles & Hierarchy
Define as a TypeScript enum in common/enums/role.enum.ts:

enum Role {
  SUPERADMIN = 'SUPERADMIN',  // Unrestricted access to everything
  ADMIN      = 'ADMIN',       // Manages users and content, but cannot touch other admins or superadmin
  USER       = 'USER',        // Can buy and sell items on the platform
}

- A user can only hold ONE role at a time (no multi-role).
- Default role on registration: USER.
- Role hierarchy enforcement:
    SUPERADMIN can manage ADMIN and USER accounts (create, suspend, delete, assign roles).
    ADMIN can only manage USER accounts — they cannot view, edit, suspend, or delete other ADMINs or the SUPERADMIN.
    SUPERADMIN is the only role that can promote/demote ADMINs.

## Permissions
Define granular permissions as constants in common/enums/permission.enum.ts:

enum Permission {
  // Item permissions (for USER role)
  ITEM_BUY          = 'item:buy',
  ITEM_SELL         = 'item:sell',
  ITEM_VIEW         = 'item:view',
  ITEM_MANAGE_OWN   = 'item:manage_own',

  // User self-service
  PROFILE_VIEW      = 'profile:view',
  PROFILE_EDIT      = 'profile:edit',

  // Admin permissions
  USER_VIEW         = 'user:view',
  USER_MANAGE       = 'user:manage',
  CONTENT_MODERATE  = 'content:moderate',

  // Superadmin-only permissions
  ADMIN_VIEW        = 'admin:view',
  ADMIN_MANAGE      = 'admin:manage',
  ROLE_ASSIGN       = 'role:assign',
  SYSTEM_CONFIG     = 'system:config',
}

## Role → Permission Mapping
- Permissions are derived from roles — never assigned individually to users directly.
- Mapping defined centrally in auth/role-permissions.map.ts:

  USER       → [ITEM_BUY, ITEM_SELL, ITEM_VIEW, ITEM_MANAGE_OWN, PROFILE_VIEW, PROFILE_EDIT]
  ADMIN      → [USER_VIEW, USER_MANAGE, CONTENT_MODERATE, ITEM_VIEW, PROFILE_VIEW]
  SUPERADMIN → All permissions (wildcard — bypass all permission checks)

## Guards & Decorators
- Implement three guards in common/guards/:
    JwtAuthGuard     : Validates access token, attaches user to request. Applied GLOBALLY.
    PermissionsGuard : Checks user permissions against required permissions on route.
    HierarchyGuard   : Before any admin action on a user account, verifies the acting user has authority over the target user's role.

- Use @Public() decorator to explicitly opt out of JwtAuthGuard for public routes (e.g. login, register).
- Use @RequirePermissions() decorator to declare required permissions per route.

## Endpoint Access Matrix
| Endpoint                        | Required Permission | Special Guards |
|---------------------------------|---------------------|----------------|
| POST /auth/register             | @Public()           | None           |
| POST /auth/login                | @Public()           | None           |
| POST /auth/refresh              | @Public()           | None           |
| POST /auth/logout               | Authenticated       | None           |
| GET  /users/me                  | PROFILE_VIEW        | None           |
| PATCH /users/me                 | PROFILE_EDIT        | None           |
| GET  /users                     | USER_VIEW           | None           |
| PATCH /users/:id/suspend        | USER_MANAGE         | HierarchyGuard |
| DELETE /users/:id               | USER_MANAGE         | HierarchyGuard |
| POST /users/:id/role            | ROLE_ASSIGN         | HierarchyGuard |

## Ownership Rules
- Enforce ownership in the service layer — users can only edit their own profile.
- ADMINs cannot touch other ADMINs; only SUPERADMIN can manage ADMINs.
- SUPERADMIN bypasses all ownership and permission checks.

## Security & Rate Limiting
- Passwords hashed with bcrypt, minimum 12 salt rounds.
- Rate limit auth endpoints using @nestjs/throttler:
    POST /auth/login    : 5 attempts per 15 minutes per IP
    POST /auth/register : 10 attempts per hour per IP
    POST /auth/refresh  : 20 attempts per 15 minutes per IP