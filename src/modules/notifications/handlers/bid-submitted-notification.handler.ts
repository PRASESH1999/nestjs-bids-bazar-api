import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type { BidSubmittedPayload } from '@common/events/event-payloads.type';
import { NotificationType } from '@common/enums/notification-type.enum';
import { NotificationsService } from '../notifications.service';

/**
 * Creates in-app notifications for the two bid.submitted outcomes: the
 * seller on the first bid, or the previous highest bidder on every
 * subsequent (outbidding) bid.
 *
 * Idempotency: this is a create-only side effect, not a state transition, so
 * there is no "current state" to re-check — the repository's unique index
 * on (userId, type, relatedId) is the idempotency guard. A replayed event
 * simply no-ops on the duplicate-key catch.
 */
@Injectable()
export class BidSubmittedNotificationHandler {
  private readonly logger = new Logger(BidSubmittedNotificationHandler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(EventNames.BID_SUBMITTED, { async: true })
  async handle(payload: BidSubmittedPayload): Promise<void> {
    const jobId = uuidv4();

    this.logger.log('Handling bid.submitted notification', {
      jobId,
      productId: payload.productId,
      bidId: payload.bidId,
    });

    try {
      if (payload.wasFirstBid) {
        await this.notificationsService.createForUser({
          userId: payload.productOwnerId,
          type: NotificationType.BID_PLACED_SELLER,
          relatedId: payload.bidId,
          title: 'Your auction is live',
          message: `A first bid of ${payload.amount} was placed on "${payload.productTitle}".`,
          data: { productId: payload.productId, amount: payload.amount },
        });
      } else if (payload.previousHighestBidderId) {
        await this.notificationsService.createForUser({
          userId: payload.previousHighestBidderId,
          type: NotificationType.OUTBID,
          relatedId: payload.bidId,
          title: "You've been outbid",
          message: `Someone outbid you on "${payload.productTitle}" — the new highest bid is ${payload.amount}.`,
          data: {
            productId: payload.productId,
            yourBidAmount: payload.previousBidAmount,
            newHighestBid: payload.amount,
          },
        });
      }

      this.logger.log('bid.submitted notification handled', {
        jobId,
        productId: payload.productId,
      });
    } catch (error) {
      this.logger.error('Failed to handle bid.submitted notification', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
