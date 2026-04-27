import { DataSource } from 'typeorm';
import { EmailVerificationToken } from "./entities/email-verification-token.entity";
export declare class AuthRepository {
    private readonly dataSource;
    private readonly repo;
    constructor(dataSource: DataSource);
    deleteTokensByUserId(userId: string): Promise<void>;
    saveToken(userId: string, tokenHash: string, expiresAt: Date): Promise<EmailVerificationToken>;
    findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null>;
    deleteById(id: string): Promise<void>;
    countTokensSince(userId: string, since: Date): Promise<number>;
}
