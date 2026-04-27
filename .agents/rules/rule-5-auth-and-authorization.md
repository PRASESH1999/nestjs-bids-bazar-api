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

---

## RuleKYC Verification

### Who needs KYC
- Any USER who wants to SELL a product must have a KYC status of APPROVED.
- Users without KYC or with PENDING/REJECTED KYC can only BUY products.
- KYC is optional for buyers — no restrictions on purchasing.
- KYC is enforced at the service layer when a user attempts to create a listing.

### KYC Flow
1. User submits KYC via POST /kyc/submit (uploads documents + fills address + bank details)
2. KYC status is set to PENDING immediately on submission
3. ADMIN or SUPERADMIN reviews the submission via the admin endpoints
4. ADMIN approves → status becomes APPROVED → user can now sell
   ADMIN rejects → status becomes REJECTED → user must resubmit with corrections
5. A user with REJECTED status may resubmit — this resets status to PENDING
6. A user with PENDING or APPROVED status cannot resubmit

### Document Requirements
- User must upload EITHER:
    Citizenship: front image AND back image (both required together)
    OR
    Passport: single image
- Mixing document types is not allowed
- Accepted formats: JPEG, PNG, PDF
- Max file size: 5 MB per file

### Address Requirements
- Permanent address: required (street, city, district, province, country)
- Temporary address: optional (same structure)
- Country defaults to Nepal

### Bank Details
- Required at KYC submission time
- Sensitive fields (accountNumber, branch, swiftCode) are encrypted at rest
  using AES-256-GCM via EncryptionService (common/services/encryption.service.ts)
- Bank details are used later for seller payouts
- Only SUPERADMIN can view decrypted bank details (BANK_VIEW_DECRYPTED permission)

### File Storage
- Document images are saved to the local server filesystem (no S3 or cloud bucket)
- Stored under: /uploads/kyc/:userId/ (relative to UPLOAD_BASE_DIR env var)
- Files are served via a protected endpoint — never publicly accessible
- Only ADMIN and SUPERADMIN can access document files via GET /kyc/:id/documents/:fileKey
- The /uploads/ directory is in .gitignore — never commit uploaded files

### Permissions
Added to Permission enum (common/enums/permission.enum.ts):
  KYC_SUBMIT          = 'kyc:submit'         → USER
  KYC_VIEW_OWN        = 'kyc:view_own'       → USER
  KYC_VIEW_ALL        = 'kyc:view_all'       → ADMIN, SUPERADMIN
  KYC_REVIEW          = 'kyc:review'         → ADMIN, SUPERADMIN
  BANK_VIEW_DECRYPTED = 'bank:view_decrypted' → SUPERADMIN only

### Endpoint Access Matrix
| Endpoint                           | Required Permission  |
|------------------------------------|----------------------|
| POST /kyc/submit                   | KYC_SUBMIT           |
| GET  /kyc/me                       | KYC_VIEW_OWN         |
| GET  /kyc                          | KYC_VIEW_ALL         |
| GET  /kyc/:id                      | KYC_VIEW_ALL         |
| PATCH /kyc/:id/review              | KYC_REVIEW           |
| GET  /kyc/:id/bank                 | BANK_VIEW_DECRYPTED  |
| GET  /kyc/:id/documents/:fileKey   | KYC_VIEW_ALL         |

### Sell Gate (enforced in listings/items service — NOT in KYC module)
- Before creating a listing, the items/listings service must call
  kycService.isVerified(userId) which returns true only if KycStatus === APPROVED
- If not verified: throw ForbiddenException with message:
  'KYC verification required to sell products. Please complete and submit your KYC.'
- This check is the responsibility of the feature module (items),
  not the KYC module itself
- KycModule exports KycService so the items module can inject it directly

### Encryption Key Management
- ENCRYPTION_KEY env var: 32-byte hex string (64 hex characters)
- Generate with: openssl rand -hex 32
- Never log plaintext values or the key
- UPLOAD_BASE_DIR env var: base directory for uploads (e.g. ./uploads)

---

## Email Verification

### Flow
1. User registers → account created with isEmailVerified: false
2. Verification email sent automatically on registration
3. JWT is NOT issued on registration — user must verify email first
4. User clicks verification link in email → isEmailVerified set to true
5. User can now log in normally
6. If user tries to log in with an unverified email → blocked with 403 and
   code: "EMAIL_NOT_VERIFIED" so the frontend can show a resend button

### Token Rules
- Verification token generated with crypto.randomBytes(32)
- Raw token sent in email link — NEVER stored in DB
- Only the SHA-256 hash of the token is stored in DB
- Token expires in 24 hours
- Token deleted immediately after successful verification
- Any existing token for a user is invalidated before issuing a new one

### Resend Rules
- User requests resend via POST /auth/resend-verification (body: { email })
- Rate limited: max 3 resends per hour per email address
- If email already verified: return 400 "Email already verified"
- Always invalidate existing token before creating a new one

### Impact on Other Modules
- Unverified users never receive a JWT — no guard changes needed elsewhere
- KYC submission is naturally gated — if they can log in, email is verified
- Selling requires: isEmailVerified (via login gate) AND KYC status === APPROVED
- Buying requires: isEmailVerified (via login gate)

### Notification Emails
- On registration → verification email with link (24hr expiry)
- On KYC submission → "We received your KYC submission, it is under review"
- On KYC approval → "Your KYC has been approved. You can now sell on Antigravity."
- On KYC rejection → "Your KYC was rejected. Reason: [rejectionReason]. Please resubmit."
- On resend request → fresh verification email

### Security Rules
- Never log raw tokens anywhere
- Never return the token in any API response
- Rate limit resend endpoint: 3 per hour per email
- Verification link format: GET /auth/verify-email?token=<rawToken>
- Token is single-use — invalidated immediately on use

### Endpoint Access Matrix (additions)
| Endpoint                           | Auth         | Notes                             |
|------------------------------------|--------------|-----------------------------------|
| GET  /auth/verify-email?token=...  | @Public()    | Verifies email, single-use token  |
| POST /auth/resend-verification     | @Public()    | Rate-limited: 3/hr per IP + email |

### Entity: EmailVerificationToken
Lives in: modules/auth/entities/email-verification-token.entity.ts
- id: UUID (primary key)
- userId: UUID (FK → users, indexed)
- tokenHash: string (SHA-256 hash of raw token — never store raw)
- expiresAt: timestamptz
- createdAt: timestamptz

### Mail Module
- Lives in: modules/mail/
- Registered as @Global() so any module can inject MailService
- Uses nodemailer with SMTP config from env
- Templates: plain functions returning { subject, html } — no template engine
- Required env vars: MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USER,
  MAIL_PASSWORD, MAIL_FROM, APP_FRONTEND_URL