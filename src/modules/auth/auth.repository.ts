import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EmailVerificationToken } from '@modules/auth/entities/email-verification-token.entity';

/**
 * Repository responsible for all EmailVerificationToken persistence operations.
 * Raw tokens are never handled here — only hashed values.
 */
@Injectable()
export class AuthRepository {
  private readonly repo: Repository<EmailVerificationToken>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(EmailVerificationToken);
  }

  /**
   * Delete all existing tokens for a user before issuing a new one.
   * Ensures single-use / non-accumulating tokens per user.
   */
  async deleteTokensByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  /**
   * Persist a new hashed verification token for the given user.
   */
  async saveToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<EmailVerificationToken> {
    const token = this.repo.create({ userId, tokenHash, expiresAt });
    return this.repo.save(token);
  }

  /**
   * Find a token record by its SHA-256 hash.
   */
  async findByTokenHash(
    tokenHash: string,
  ): Promise<EmailVerificationToken | null> {
    return this.repo.findOneBy({ tokenHash });
  }

  /**
   * Delete a token record by its id (used after successful verification).
   */
  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  /**
   * Count tokens created for a user within the given time window.
   * Used for rate-limiting resend requests (max 3 per hour per user).
   */
  async countTokensSince(userId: string, since: Date): Promise<number> {
    return this.repo
      .createQueryBuilder('evt')
      .where('evt.user_id = :userId', { userId })
      .andWhere('evt.created_at >= :since', { since })
      .getCount();
  }
}
