import { DataSource } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { PasswordResetToken } from "./entities/password-reset-token.entity";
export declare class PasswordResetRepository {
    private readonly dataSource;
    private readonly repo;
    constructor(dataSource: DataSource);
    softDeleteByUserId(userId: string): Promise<void>;
    saveToken(userId: string, tokenHash: string, expiresAt: Date, queryRunner?: QueryRunner): Promise<PasswordResetToken>;
    findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
    deleteById(id: string, queryRunner?: QueryRunner): Promise<void>;
    countRequestsSince(userId: string, since: Date): Promise<number>;
    deleteExpiredBefore(cutoff: Date): Promise<number>;
}
