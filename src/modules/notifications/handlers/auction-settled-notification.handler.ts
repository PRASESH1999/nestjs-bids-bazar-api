import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type { AuctionSettledPayload } from '@common/events/event-payloads.type';
import { NotificationType } from '@common/enums/notification-type.enum';
import { NotificationsService } from '../notifications.service';

/**
 * Creates in-app notifications when payment is confirmed and a sale settles.
 * Fires for both confirmPaymentManual() (admin) and confirmPaymentGateway()
 * (Fonepay) paths, since both emit the same auction.settled event.
 *
 * Idempotency: relies on the repository's unique index on
 * (userId, type, relatedId) — winningBidId is stable per product.
 */
@Injectable()
export class AuctionSettledNotificationHandler {
  private readonly logger = new Logger(AuctionSettledNotificationHandler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(EventNames.AUCTION_SETTLED, { async: true })
  async handle(payload: AuctionSettledPayload): Promise<void> {
    const jobId = uuidv4();

    this.logger.log('Handling auction.settled notification', {
      jobId,
      productId: payload.productId,
      winningBidId: payload.winningBidId,
    });

    try {
      await this.notificationsService.createForUser({
        userId: payload.sellerId,
        type: NotificationType.PAYMENT_CONFIRMED_SELLER,
        relatedId: payload.winningBidId,
        title: 'Sold — hand the item in at the warehouse',
        // No warehouse address yet (OPEN-ITEMS A44) — "the warehouse" until one exists.
        message: `Payment of ${payload.amount} for "${payload.productTitle}" has been confirmed. Please bring the item to the Bids Bazar warehouse so we can ship it to the buyer. Your payout follows once it is handed in.`,
        data: { productId: payload.productId, amount: payload.amount },
      });

      await this.notificationsService.createForUser({
        userId: payload.buyerId,
        type: NotificationType.PAYMENT_CONFIRMED_BUYER,
        relatedId: payload.winningBidId,
        title: 'Payment confirmed',
        message: `Your payment of ${payload.buyerTotalAmount} for "${payload.productTitle}" is confirmed, delivery included. We will ship it to you with Pathao once the seller hands it in at our warehouse.`,
        data: {
          productId: payload.productId,
          amount: payload.buyerTotalAmount,
        },
      });

      this.logger.log('auction.settled notification handled', {
        jobId,
        productId: payload.productId,
      });
    } catch (error) {
      this.logger.error('Failed to handle auction.settled notification', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
