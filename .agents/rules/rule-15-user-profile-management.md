# Rule 15: User Self-Profile Management

> Cross-references: Rule 5 (Auth & Authorization), Rule 12 (Database Schema Maintenance)

This rule governs the three self-service profile features available to authenticated users:
viewing their own profile, setting/correcting their full name and phone, and changing their email address (with re-verification).

---

## 1. GET /users/me — Own Profile

**Controller:** `UsersController.getProfile`
**Service:** `UsersService.getOwnProfile`
**Permission:** `PROFILE_VIEW`

Returns an `OwnProfileResponse` object containing:

| Field | Source |
|---|---|
| `id`, `fullName`, `username`, `email`, `role`, `isActive`, `isEmailVerified` | `users` table |
| `isNameVerified` | KYC status is `APPROVED` |
| `canEditName` | KYC is neither `PENDING` nor `APPROVED` |
| `missingProfileFields` | `computeMissingProfileFields()` (`modules/users/profile-completion.ts`) |
| `phone`, `isPhoneVerified`, `phoneVerifiedAt`, `pendingPhone` | `users` table |
| `createdAt`, `updatedAt` | `users` table |

> The owner sees BOTH their `fullName` (private) and `username` (public handle) on their
> own profile — no privacy concern, it is their own record.
| `kyc` | Fetched via `dataSource.getRepository(KycVerification)` — `null` if no KYC record |
| `pendingEmailChange` | Fetched via `dataSource.getRepository(PendingEmailChange)` — `null` if none |

- Sensitive fields (`password`, `hashedRefreshToken`) are **never** included in the response.
- KYC and PendingEmailChange are fetched using `DataSource.getRepository()` directly in `UsersService` to avoid circular module dependency (KycModule imports UsersModule; UsersModule must not import KycModule).

---

## 2. PATCH /users/me — Full Name & Phone

**Controller:** `UsersController.updateProfile`
**Service:** `UsersService.updateOwnProfile`
**DTO:** `UpdateSelfDto` — `fullName?` (2–150, trimmed), `phone?` (`^\+?\d{7,15}$`)
**Permission:** `PROFILE_EDIT`

Name and phone are collected at registration (`POST /auth/register`). This endpoint is the
"complete your profile" step for social signups (login returns `missingProfileFields`), and
how a KYC-rejected name is corrected before resubmitting.

### Name
- Free to change while there is no KYC, or after a REJECTED one.
- `409` while KYC is `PENDING` (the reviewer is checking the snapshot) or `APPROVED` (verified).

### Phone
- Never written to `users.phone` (verified numbers only) — it becomes `pendingPhone`, and the
  outstanding OTP state is cleared, because that code went to a different number.
- Sending the account's own verified number cancels a pending change.
- `409` if the number is another account's verified `phone` (`UsersService.assertPhoneNotTaken`).

There is no name-change quota, confirmation email, or admin reset any more.

---

## 2a. Username — Public Handle (system-generated, never typed)

`username` is the **only** user-identifying field shown to OTHER users. `fullName` is
**private** — it appears solely in KYC review, admin views, and the user's own profile.
Every public-facing surface (product detail top-bidders, the live SSE auction feed,
the non-admin bids list) exposes `username`, never `fullName`.

### Generation (single source of truth)

`username` is **system-generated** at account-creation time — nobody ever types one, for
public registration (`POST /auth/register`) or admin creation (`POST /users/admin`). There
is no format validator, no reserved-word list, no availability-check endpoint, and no
change path (self-service or admin) — the value is permanent from creation.

- Format: `` `BB${sequence.padStart(6, '0')}-${year}` `` , e.g. `BB000001-2026`.
- `formatGeneratedUsername()` in `modules/users/username-generator.ts` builds the string;
  `UsersService.generateNextUsername()` pulls the number via
  `UsersRepository.nextUsernameSequenceValue()` (`SELECT nextval('username_seq')`) and stamps
  the current calendar year.
- `nextval('username_seq')` is atomic across concurrent Postgres sessions — two simultaneous
  account creations can never receive the same sequence value, no locking/retry needed.
- The 6-digit padding never resets; past 999,999 accounts it simply stops zero-padding.
- Backed by a column-level `unique` constraint on `users.username` as a safety net.

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
| `GET /users/me` | JWT | `PROFILE_VIEW` | USER, ADMIN, SUPERADMIN |
| `PATCH /users/me` | JWT | `PROFILE_EDIT` | USER |
| `PATCH /users/me/email` | JWT | `PROFILE_EDIT` | USER |
| `PATCH /users/me/password` | JWT | `PROFILE_EDIT` | USER |
| `GET /auth/verify-email-change` | Public | — | Anyone with the link |

---

## 8. Out of scope

- Account self-deactivation is **not** implemented. Accounts can only be suspended by an admin via `PATCH /users/:id/suspend`.
