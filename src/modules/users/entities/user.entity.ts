import { Entity, Column, Index } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '@common/entities/base.entity';
import { Role } from '@common/enums/role.enum';

@Entity('users')
export class User extends BaseEntity {
  /*
   * `username` is the public identity everywhere: seller cards, admin lists and
   * transactional email all address people by it. It is system-generated and
   * stable, which is exactly what those surfaces need.
   */

  // System-generated public handle (e.g. BB000001-2026) assigned via the
  // `username_seq` Postgres sequence at account-creation time. Never typed by
  // a user or an admin. Backed by a DB unique constraint as a safety net.
  @Column({ type: 'varchar', length: 30, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /*
   * The person's full name. The one place it is stored.
   *
   * Collected at registration (or taken from the Google/Facebook profile) and
   * self-declared until KYC is APPROVED, at which point the reviewer has
   * checked it against the identity document. KycService.submitKyc snapshots it
   * onto the submission so the record shows exactly what was reviewed. Editable
   * via PATCH /users/me until KYC is submitted, locked while it is under review
   * or approved.
   *
   * Nullable only because a social provider may not share a name; such an
   * account is asked for it right after signup (see `missingProfileFields`).
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  fullName: string | null;

  // Null for accounts created via social login (Google/Facebook) that have
  // never set a local password.
  //
  // `@Exclude()` is a serialisation guard, not a read guard: the column is
  // still loaded and still available to AuthService for comparison. It is
  // dropped on the way out, by the global ClassSerializerInterceptor.
  //
  // This matters because several endpoints join a User relation and return the
  // entity directly — `/admin/bids` embeds `bid.bidder`, `/payments/admin/all`
  // embeds both `winner` and `seller`, `/admin/products/:id/settlements`
  // embeds `bidWinner`. Each one of those shipped the bcrypt hash to every
  // authenticated admin client. Excluding at the entity closes all of them at
  // once and, more to the point, closes the next one nobody remembers to check.
  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  googleId: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  facebookId: string | null;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER,
  })
  role: Role;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  // Excluded for the same reason as `password` — it is a bearer credential:
  // anyone holding it can mint a fresh access token for this account.
  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  hashedRefreshToken: string | null;

  // ─── Phone ────────────────────────────────────────────────────────────────
  /*
   * The account's verified phone number, and the OTP state behind it.
   *
   * This lives on User rather than on KYC because verification now *precedes*
   * KYC: a phone is how the platform reaches an account, so it is established
   * once and then reused, instead of being re-proved inside every submission.
   *
   * Unique: a verified number identifies one account. Holds only a *verified*
   * number, so it is null until the first OTP is confirmed — the number given
   * at registration waits in `pendingPhone`. Keeping unverified numbers out of
   * this column is what stops someone squatting another person's number.
   */
  @Index({ unique: true, where: '"phone" IS NOT NULL' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  // Null until the OTP is confirmed. Stored as a timestamp rather than a
  // boolean so "when" is answerable; `isPhoneVerified` is derived from it in
  // the response mapper.
  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;

  // OTP state. Excluded for the same reason as `password` — the hash is a
  // credential, and the attempt counter is not something a client should be
  // able to read around.
  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  phoneOtpHash: string | null;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  phoneOtpExpiresAt: Date | null;

  @Exclude()
  @Column({ type: 'int', default: 0 })
  phoneOtpAttempts: number;

  // A number awaiting verification: the one given at registration (or via
  // PATCH /users/me), or one an OTP has been sent to. Kept separate from
  // `phone` so a verified number is never overwritten by an unconfirmed one.
  // Not unique — two accounts may both claim a number; the first to verify it
  // keeps it (PhoneVerificationService.verifyOtp).
  @Column({ type: 'varchar', length: 20, nullable: true })
  pendingPhone: string | null;

  // ─── Seller rating aggregates ────────────────────────────────────────────
  // Recomputed from scratch (AVG/COUNT over seller_ratings) inside the same
  // transaction as every new rating insert — never patched incrementally, so
  // these can never drift from the underlying rows. See RatingsRepository.

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;
}
