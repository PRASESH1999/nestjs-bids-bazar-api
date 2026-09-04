import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type { WinTransferredPayload } from '@common/events/event-payloads.type';
import { NotificationType } from '@common/enums/notification-type.enum';
import { NotificationsService } from '../notifications.service';

/**
 * Creates in-app notifications when a payment default promotes the next
 * fallback bidder: the new responsible bidder is told they're now winning,
 * the seller is told the chain advanced.
 *
 * Idempotency: uses newWinningBidId (the newly-promoted bid) as relatedId,
 * NOT productId — a single product can go through multiple fallback rounds,
 * and keying on productId would make the second round's insert collide with
 * the first's on the (userId, type, relatedId) unique index, silently
 * swallowing the seller's second notification.
 */
@Injectable()
export class WinTransferredNotificationHandler {
  private readonly logger = new Logger(WinTransferredNotificationHandler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(EventNames.WIN_TRANSFERRED, { async: true })
  async handle(payload: WinTransferredPayload): Promise<void> {
    const jobId = uuidv4();

    this.logger.log('Handling win.transferred notification', {
      jobId,
      productId: payload.productId,
      newWinningBidId: payload.newWinningBidId,
    });

    try {
      await this.notificationsService.createForUser({
        userId: payload.toUserId,
        type: NotificationType.PAYMENT_FAILED_FALLBACK,
        relatedId: payload.newWinningBidId,
        title: "You're now the winning bidder",
        message: `The previous winner didn't pay in time — you're now responsible for "${payload.productTitle}" at ${payload.winningAmount}.`,
        data: {
          productId: payload.productId,
          winningAmount: payload.winningAmount,
          paymentDeadline: payload.newPaymentDeadline,
        },
      });

      await this.notificationsService.createForUser({
        userId: payload.sellerId,
        type: NotificationType.PAYMENT_FAILED_SELLER,
        relatedId: payload.newWinningBidId,
        title: 'Buyer defaulted — next bidder promoted',
        message: `The previous winning bidder for "${payload.productTitle}" failed to pay. The next highest bidder has been given a new payment window.`,
        data: {
          productId: payload.productId,
          fallbackRank: payload.fallbackRank,
        },
      });

      this.logger.log('win.transferred notification handled', {
        jobId,
        productId: payload.productId,
      });
    } catch (error) {
      this.logger.error('Failed to handle win.transferred notification', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
