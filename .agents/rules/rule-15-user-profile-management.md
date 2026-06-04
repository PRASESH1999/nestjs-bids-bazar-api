# Rule 15: User Self-Profile Management

> Cross-references: Rule 5 (Auth & Authorization), Rule 12 (Database Schema Maintenance)

This rule governs the three self-service profile features available to authenticated users:
viewing their own profile, changing their display name (one-time), and changing their email address (with re-verification).

---

## 1. GET /users/me — Own Profile

**Controller:** `UsersController.getProfile`
**Service:** `UsersService.getOwnProfile`
**Permission:** `PROFILE_VIEW`

Returns an `OwnProfileResponse` object containing:

| Field | Source |
|---|---|
| `id`, `name`, `username`, `email`, `role`, `isActive`, `isEmailVerified` | `users` table |
| `nameChangedAt` | `users.nameChangedAt` — `null` = quota available |
| `usernameChangedAt` | `users.usernameChangedAt` — `null` = quota available |
| `createdAt`, `updatedAt` | `users` table |

> The owner sees BOTH their `name` (private) and `username` (public handle) on their
> own profile — no privacy concern, it is their own record.
| `kyc` | Fetched via `dataSource.getRepository(KycVerification)` — `null` if no KYC record |
| `pendingEmailChange` | Fetched via `dataSource.getRepository(PendingEmailChange)` — `null` if none |

- Sensitive fields (`password`, `hashedRefreshToken`) are **never** included in the response.
- KYC and PendingEmailChange are fetched using `DataSource.getRepository()` directly in `UsersService` to avoid circular module dependency (KycModule imports UsersModule; UsersModule must not import KycModule).

---

## 2. PATCH /users/me — One-Time Display Name Change

**Controller:** `UsersController.updateProfile`
**Service:** `UsersService.updateSelfName`
**DTO:** `UpdateSelfDto` — `name` only (`@IsString @IsNotEmpty @MaxLength(255)`)
**Permission:** `PROFILE_EDIT`

### Quota logic
- `user.nameChangedAt === null` — quota available; proceed.
- `user.nameChangedAt !== null` — quota consumed; throw `403 ForbiddenException`.
- On success: set `nameChangedAt = now` alongside the name update.

### Side effects
- Confirmation email sent to the user's current address (`sendNameChangedConfirmation`).
- Email failure is caught, logged, and **never re-thrown**.

### Admin override
- `POST /admin/users/:id/reset-name-change` calls `UsersService.resetNameChangeQuota`, which sets `nameChangedAt = null`.
- Requires `Permission.NAME_CHANGE_RESET` (SUPERADMIN-only).

---

## 2a. Username — Public Handle (public vs private split)

`username` is the **only** user-identifying field shown to OTHER users. `name` is
**private** — it appears solely in emails, admin views, and the user's own profile.
Every public-facing surface (product detail top-bidders, the live SSE auction feed,
the non-admin bids list) exposes `username`, never `name`. Admin/moderation surfaces
keep `name` (and email) because real identity is required for moderation.

### Validation rules (single source of truth)

Centralized in `modules/users/username.validator.ts` and reused by registration, the
availability endpoint, and the change endpoint. Validation runs on the **lowercased**
input; the value is **stored as-typed** for display but compared lowercase everywhere.

- Length **3–30** characters.
- Allowed characters: lowercase `a–z`, digits `0–9`, underscore `_`, period `.`, hyphen `-`.
- Cannot start or end with `.` or `-`.
- Cannot contain consecutive `..`, `--`, or `__`.
- Reserved (rejected case-insensitively): `admin`, `superadmin`, `support`, `bidsbazar`,
  `null`, `system`, `root`, `api`. **Seeds bypass** this list (they write directly via the
  repository / DataSource — seeded admins may use reserved handles such as `superadmin`).
- **Uniqueness is case-insensitive** — `RamSharma` and `ramsharma` cannot coexist.
  Enforced in the service layer via `LOWER(username)` lookups, backed by the column-level
  `unique` constraint on `users.username` (the case-insensitive uniqueness is implemented
  via service-layer lowercase lookup, not an expression index).

---

## 2b. PATCH /users/me/username — One-Time Username Change

**Controller:** `UsersController.updateUsername`
**Service:** `UsersService.updateSelfUsername`
**DTO:** `UpdateUsernameDto` — `username` only (`@IsString @IsNotEmpty @IsValidUsername`)
**Permission:** `PROFILE_EDIT`
**Throttle:** `@Throttle({ default: { limit: 5, ttl: 3600000 } })` (5/hour per IP, matching email change)

### Logic (order matters)
1. Load user; throw `404 NotFoundException` if missing.
2. **Same-value guard FIRST** — if `newUsername.trim().toLowerCase()` equals the current
   username (lowercased), throw `400 BadRequestException`. Placed **before** the quota guard
   so a no-op attempt never consumes the one-time quota.
3. Quota: `usernameChangedAt === null` → available; non-null → throw `403 ForbiddenException`
   (`'Username can only be changed once. Please contact support.'`).
4. Case-insensitive uniqueness check against OTHER users → throw `409 ConflictException('USERNAME_TAKEN')` if taken.
5. On success: update `username` (as-typed) and `usernameChangedAt = now` in the same operation.

### Side effects
- Confirmation email sent via `MailService.sendUsernameChangedConfirmation`.
- Email failure is caught, logged, and **never re-thrown** (mirrors the name-change pattern).

### Admin override
- `POST /admin/users/:id/reset-username-change` calls `UsersService.resetUsernameChangeQuota`,
  which sets `usernameChangedAt = null`.
- Requires `Permission.USERNAME_CHANGE_RESET` (SUPERADMIN-only).

---

## 2c. GET /users/username-available — Availability Check

**Controller:** `UsersController.checkUsernameAvailability`
**Service:** `UsersService.checkUsernameAvailability`
**Decorator:** `@Public()` (no JWT required)
**Throttle:** `@Throttle({ default: { limit: 30, ttl: 60000 } })` (30/min per IP — the frontend debounce-checks on keystrokes)

- Query param: `?username=foo`.
- Validates format + reserved list using the shared validator, then performs a
  case-insensitive existence check. Does **NOT** reserve the username.
- **Always returns 200** — it is an availability query, never throws on invalid input.
- Response: `{ available: true }` or `{ available: false, reason: 'INVALID_FORMAT' | 'RESERVED' | 'TAKEN' }`.

---

## 3. PATCH /users/me/email — Email Change Request

**Controller:** `UsersController.requestEmailChange`
**Service:** `UsersService.requestEmailChange`
**DTO:** `ChangeEmailDto` — `newEmail` (`@IsEmail @MaxLength(255)`) + `currentPassword` (`@IsString @IsNotEmpty @MaxLength(255)`)
**Permission:** `PROFILE_EDIT`

### Flow
1. Re-authenticate: compare `currentPassword` against `user.password` (bcrypt). Throw `401` on mismatch.
2. Reject if `newEmail == user.email` (case-insensitive). Throw `400`.
3. Check uniqueness: if another user owns `newEmail`, throw `409 ConflictException`.
4. Hard-delete any existing `pending_email_changes` row for this user (`deleteByUserId`).
5. Generate 32-byte raw token; store SHA-256 hash in `pending_email_changes`. `expiresAt = now + 1 hour`.
6. Send verification email to `newEmail` (`sendEmailChangeVerification`). Failure is caught and logged — never re-thrown.
7. Return `200` with a generic success message.

### Rate limiting
- IP-level: `@Throttle({ default: { limit: 5, ttl: 3600000 } })` on the controller endpoint.
- No per-email service-layer rate limit (the uniqueness constraint + 1-per-user record caps abuse sufficiently).

---

## 4. GET /auth/verify-email-change?token=... — Email Change Verification

**Controller:** `AuthController.verifyEmailChange`
**Service:** `AuthService.verifyEmailChange`
**Decorator:** `@Public()` (no JWT required — link clicked from email)

### Flow
1. Hash the raw token (SHA-256); look up `pending_email_changes` by `tokenHash`.
2. Not found — throw `404 NotFoundException` with generic message.
3. Expired (`expiresAt < now`) — hard-delete the row; throw `404` with generic message.
4. Load user; check `isActive`. Inactive — throw `404`.
5. **Atomic transaction** (explicit `queryRunner`):
   - Update `users`: `email = newEmail`, `isEmailVerified = true`, `hashedRefreshToken = null` (all sessions invalidated).
   - Hard-delete the `pending_email_changes` row.
   - Commit.
6. After commit: send two emails (failures caught/logged, never re-thrown):
   - `sendEmailChangedNotificationToOld(oldEmail, userName, newEmail)` — security alert to old address.
   - `sendEmailChangedNotificationToNew(newEmail, userName)` — confirmation to new address.
7. Return `200`. Client must log in again (sessions invalidated).

---

## 5. PendingEmailChange Entity

- Table: `pending_email_changes`
- `userId` is **unique** — at most one pending request per user at any time.
- `newEmail` stored as plaintext. The raw token is NEVER persisted.
- `tokenHash` is SHA-256 of the raw token. No soft-delete.
- Daily cron (`AuthCleanupCron.cleanupExpiredPendingEmailChanges`) hard-deletes rows where `expiresAt < now`.

---

## 6. Security rules

- The verification endpoint must always be `@Public()`.
- Error messages for invalid/expired tokens are always generic — never leak token existence.
- Current password is always required before initiating an email change.
- After a successful change, `hashedRefreshToken = null` — all sessions invalidated. User must log in again.
- Email swap and session invalidation are in a single `queryRunner` transaction — atomic.
- Notifications are sent to **both** old and new address after commit.

---

## 7. Endpoint Access Matrix

| Endpoint | Auth | Permission | Who |
|---|---|---|---|
| `GET /users/username-available` | Public | — | Anyone (throttled 30/min per IP) |
| `GET /users/me` | JWT | `PROFILE_VIEW` | USER, ADMIN, SUPERADMIN |
| `PATCH /users/me` | JWT | `PROFILE_EDIT` | USER |
| `PATCH /users/me/username` | JWT | `PROFILE_EDIT` | USER |
| `PATCH /users/me/email` | JWT | `PROFILE_EDIT` | USER |
| `PATCH /users/me/password` | JWT | `PROFILE_EDIT` | USER |
| `GET /auth/verify-email-change` | Public | — | Anyone with the link |
| `POST /admin/users/:id/reset-name-change` | JWT | `NAME_CHANGE_RESET` | SUPERADMIN only |
| `POST /admin/users/:id/reset-username-change` | JWT | `USERNAME_CHANGE_RESET` | SUPERADMIN only |

---

## 8. Out of scope

- Account self-deactivation is **not** implemented. Accounts can only be suspended by an admin via `PATCH /users/:id/suspend`.
