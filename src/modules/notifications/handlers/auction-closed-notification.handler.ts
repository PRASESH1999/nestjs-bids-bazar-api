import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type { AuctionClosedPayload } from '@common/events/event-payloads.type';
import { NotificationType } from '@common/enums/notification-type.enum';
import { NotificationsService } from '../notifications.service';

/**
 * Creates in-app notifications when an auction closes: the winner is told
 * they won and must pay, the seller is told who won. Fires for both the
 * cron/lazy closeIfExpired() path and the executeInstantBuy() path, since
 * both emit the same auction.closed event.
 *
 * Idempotency: relies on the repository's unique index on
 * (userId, type, relatedId) — winningBidId is stable per product (a product
 * only has one final winning bid), so a replayed event no-ops safely.
 */
@Injectable()
export class AuctionClosedNotificationHandler {
  private readonly logger = new Logger(AuctionClosedNotificationHandler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(EventNames.AUCTION_CLOSED, { async: true })
  async handle(payload: AuctionClosedPayload): Promise<void> {
    const jobId = uuidv4();

    this.logger.log('Handling auction.closed notification', {
      jobId,
      productId: payload.productId,
      winningBidId: payload.winningBidId,
    });

    try {
      await this.notificationsService.createForUser({
        userId: payload.winnerId,
        type: NotificationType.AUCTION_WON,
        relatedId: payload.winningBidId,
        title: 'You won the auction!',
        message: `You won "${payload.productTitle}" for ${payload.winningAmount}. Pay before the deadline to complete the purchase.`,
        data: {
          productId: payload.productId,
          winningAmount: payload.winningAmount,
          paymentDeadline: payload.paymentDeadline,
        },
      });

      await this.notificationsService.createForUser({
        userId: payload.sellerId,
        type: NotificationType.AUCTION_CLOSED_SELLER,
        relatedId: payload.winningBidId,
        title: 'Your auction has closed',
        message: `"${payload.productTitle}" sold for ${payload.winningAmount}.`,
        data: {
          productId: payload.productId,
          winningAmount: payload.winningAmount,
        },
      });

      this.logger.log('auction.closed notification handled', {
        jobId,
        productId: payload.productId,
      });
    } catch (error) {
      this.logger.error('Failed to handle auction.closed notification', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
