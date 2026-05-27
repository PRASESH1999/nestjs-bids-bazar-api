import { AuthService } from '../auth.service';
export declare class AuthCleanupCron {
    private readonly authService;
    private readonly logger;
    constructor(authService: AuthService);
    cleanupExpiredPasswordResetTokens(): Promise<void>;
    cleanupExpiredPendingEmailChanges(): Promise<void>;
}
