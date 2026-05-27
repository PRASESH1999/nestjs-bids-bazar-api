import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { PendingEmailChange } from './entities/pending-email-change.entity';

@Injectable()
export class PendingEmailChangeRepository {
  private readonly repo: Repository<PendingEmailChange>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(PendingEmailChange);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  async saveRecord(
    userId: string,
    newEmail: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const record = this.repo.create({ userId, newEmail, tokenHash, expiresAt });
    await this.repo.save(record);
  }

  async findByTokenHash(tokenHash: string): Promise<PendingEmailChange | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async deleteById(id: string, queryRunner?: QueryRunner): Promise<void> {
    if (queryRunner) {
      await queryRunner.manager.delete(PendingEmailChange, { id });
    } else {
      await this.repo.delete({ id });
    }
  }

  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(PendingEmailChange)
      .where('expires_at < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }
}
