import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthCleanupCron {
  private readonly logger = new Logger(AuthCleanupCron.name);

  constructor(private readonly authService: AuthService) {}

  @Cron('0 3 * * *') // Every day at 03:00
  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    try {
      const result = await this.authService.cleanupExpiredResetTokens();
      this.logger.log(
        `[Cron] cleanupExpiredPasswordResetTokens: deleted=${result.deleted}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[Cron] cleanupExpiredPasswordResetTokens failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Cron('0 3 * * *') // Every day at 03:00
  async cleanupExpiredPendingEmailChanges(): Promise<void> {
    try {
      const result = await this.authService.cleanupExpiredPendingEmailChanges();
      this.logger.log(
        `[Cron] cleanupExpiredPendingEmailChanges: deleted=${result.deleted}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        '[Cron] cleanupExpiredPendingEmailChanges failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
