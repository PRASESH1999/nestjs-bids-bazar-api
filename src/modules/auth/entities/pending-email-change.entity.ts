import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Stores a pending email-change request.
 * One record per user (unique on userId). A new request replaces the previous one.
 * The raw token is NEVER persisted — only sent in the verification link.
 * No soft-delete needed: the rate limit is enforced by IP-level throttler only,
 * and completed/cancelled records are hard-deleted immediately.
 */
@Entity('pending_email_changes')
export class PendingEmailChange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_pending_email_changes_user_id', { unique: true })
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 255, name: 'new_email' })
  newEmail: string;

  @Index('idx_pending_email_changes_token_hash')
  @Column({ type: 'varchar', name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
