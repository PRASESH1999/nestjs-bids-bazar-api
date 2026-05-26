import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Stores SHA-256 hashed password reset tokens.
 * The raw token is NEVER persisted — only sent in the email link.
 * Tokens expire after 1 hour and are deleted immediately after a successful reset.
 *
 * Soft-delete (@DeleteDateColumn) is intentional: invalidated-on-issue tokens must
 * remain queryable for the per-email rate limit check (countRequestsSince), even after
 * a new token supersedes them. Hard-deleting would make the count always ≤ 1 and break
 * the 3-per-hour rate limit. The daily cleanup cron removes rows older than 7 days.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_password_reset_tokens_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Index('idx_password_reset_tokens_token_hash')
  @Column({ type: 'varchar', name: 'token_hash' })
  tokenHash: string;

  @Index('idx_password_reset_tokens_expires_at')
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
