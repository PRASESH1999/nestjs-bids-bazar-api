import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Stores SHA-256 hashed email verification tokens.
 * The raw token is NEVER persisted — only sent in the email link.
 * Tokens expire after 24 hours and are deleted immediately after use.
 */
@Entity('email_verification_tokens')
export class EmailVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_email_verification_tokens_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Index('idx_email_verification_tokens_token_hash')
  @Column({ type: 'varchar', name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
