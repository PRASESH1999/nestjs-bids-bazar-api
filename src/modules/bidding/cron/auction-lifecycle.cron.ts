import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuctionLifecycleService } from '../services/auction-lifecycle.service';

@Injectable()
export class AuctionLifecycleCron {
  private readonly logger = new Logger(AuctionLifecycleCron.name);

  constructor(
    private readonly auctionLifecycleService: AuctionLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async closeExpiredAuctions(): Promise<void> {
    const startedAt = Date.now();
    try {
      const result =
        await this.auctionLifecycleService.closeAllExpiredAuctions();
      this.logger.log(
        `[Cron] closeExpiredAuctions: processed=${result.processed}, ` +
          `errors=${result.errors}, durationMs=${Date.now() - startedAt}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[Cron] closeExpiredAuctions: uncaught error after ${Date.now() - startedAt}ms`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverduePayments(): Promise<void> {
    const startedAt = Date.now();
    try {
      const result =
        await this.auctionLifecycleService.expireAllOverduePaymentWindows();
      this.logger.log(
        `[Cron] expireOverduePayments: processed=${result.processed}, ` +
          `errors=${result.errors}, durationMs=${Date.now() - startedAt}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[Cron] expireOverduePayments: uncaught error after ${Date.now() - startedAt}ms`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // Instant Buy holds are a few minutes, not 18+ hours — the once-a-minute
  // cron above would leave them up to ~59s overdue, too much slack against a
  // 3-minute window. Polled separately, far more often; cheap since there
  // are realistically 0-1 matching rows at any moment.
  @Cron('*/10 * * * * *')
  async expireOverdueInstantBuyHolds(): Promise<void> {
    const startedAt = Date.now();
    try {
      const result =
        await this.auctionLifecycleService.expireAllOverdueInstantBuyHolds();
      if (result.processed > 0 || result.errors > 0) {
        this.logger.log(
          `[Cron] expireOverdueInstantBuyHolds: processed=${result.processed}, ` +
            `errors=${result.errors}, durationMs=${Date.now() - startedAt}`,
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `[Cron] expireOverdueInstantBuyHolds: uncaught error after ${Date.now() - startedAt}ms`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Cron('0 * * * *')
  async sendPaymentWindowWarnings(): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.auctionLifecycleService.sendPaymentWarnings();
      this.logger.log(
        `[Cron] sendPaymentWindowWarnings: sent=${result.sent}, ` +
          `errors=${result.errors}, durationMs=${Date.now() - startedAt}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[Cron] sendPaymentWindowWarnings: uncaught error after ${Date.now() - startedAt}ms`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
