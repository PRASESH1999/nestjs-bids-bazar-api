export declare class PasswordResetToken {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    deletedAt: Date | null;
}
