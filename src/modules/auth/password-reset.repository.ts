import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { PasswordResetToken } from '@modules/auth/entities/password-reset-token.entity';

/**
 * Repository responsible for all PasswordResetToken persistence operations.
 * Raw tokens are never handled here — only SHA-256 hashed values.
 *
 * Soft-delete is used throughout so that invalidated tokens remain visible to
 * countRequestsSince(), which enforces the per-email rate limit (3/hour).
 */
@Injectable()
export class PasswordResetRepository {
  private readonly repo: Repository<PasswordResetToken>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(PasswordResetToken);
  }

  /**
   * Soft-delete all existing reset tokens for a user before issuing a new one.
   * Rows remain in the table so countRequestsSince() can still count them.
   */
  async softDeleteByUserId(userId: string): Promise<void> {
    await this.repo.softDelete({ userId });
  }

  /**
   * Persist a new hashed reset token for the given user.
   */
  async saveToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    queryRunner?: QueryRunner,
  ): Promise<PasswordResetToken> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(PasswordResetToken)
      : this.repo;
    const token = repo.create({ userId, tokenHash, expiresAt });
    return repo.save(token);
  }

  /**
   * Find a non-deleted (active) token by its SHA-256 hash.
   * Soft-deleted (invalidated) tokens are excluded by default.
   */
  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.repo.findOneBy({ tokenHash });
  }

  /**
   * Hard-delete a specific token row (used after successful reset or expiry cleanup).
   */
  async deleteById(id: string, queryRunner?: QueryRunner): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(PasswordResetToken)
      : this.repo;
    await repo.delete({ id });
  }

  /**
   * Count ALL tokens (active + soft-deleted) created for a user within the given
   * time window. Used for per-email rate limiting (max 3 per hour).
   * withDeleted() ensures soft-deleted (invalidated) rows are included.
   */
  async countRequestsSince(userId: string, since: Date): Promise<number> {
    return this.repo
      .createQueryBuilder('prt')
      .withDeleted()
      .where('prt.user_id = :userId', { userId })
      .andWhere('prt.created_at >= :since', { since })
      .getCount();
  }

  /**
   * Hard-delete all tokens (active or soft-deleted) whose expiresAt is before the
   * given cutoff. Used by the daily cleanup cron (cutoff = now - 7 days).
   * Direct DELETE bypasses TypeORM's soft-delete filter intentionally.
   */
  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(PasswordResetToken)
      .where('expires_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
