import { DataSource } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { PendingEmailChange } from './entities/pending-email-change.entity';
export declare class PendingEmailChangeRepository {
    private readonly dataSource;
    private readonly repo;
    constructor(dataSource: DataSource);
    deleteByUserId(userId: string): Promise<void>;
    saveRecord(userId: string, newEmail: string, tokenHash: string, expiresAt: Date): Promise<void>;
    findByTokenHash(tokenHash: string): Promise<PendingEmailChange | null>;
    deleteById(id: string, queryRunner?: QueryRunner): Promise<void>;
    deleteExpiredBefore(cutoff: Date): Promise<number>;
}
