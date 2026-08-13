import { EventNames } from '@common/events/event-names';
import type {
  PaymentFailedPayload,
  PaymentInitiatedPayload,
  PaymentSucceededPayload,
  WinTransferredPayload,
} from '@common/events/event-payloads.type';
import { AuctionBroadcastService } from '@modules/bidding/services/auction-broadcast.service';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * Relay payment domain events to the per-product SSE stream.
 * Each handler receives the event emitted by PaymentsService (or
 * AuctionLifecycleService for win.transferred) and calls
 * broadcastPaymentEvent() so all SSE subscribers of that product receive it.
 */
@Injectable()
export class PaymentEventsHandler {
  private readonly logger = new Logger(PaymentEventsHandler.name);

  constructor(private readonly broadcastService: AuctionBroadcastService) {}

  @OnEvent(EventNames.PAYMENT_INITIATED, { async: true })
  onPaymentInitiated(payload: PaymentInitiatedPayload): void {
    try {
      this.broadcastService.broadcastPaymentEvent(payload.productId, {
        type: 'payment.initiated',
        productId: payload.productId,
        paymentId: payload.paymentId,
        referenceLabel: payload.referenceLabel,
        winnerUserId: payload.winnerUserId,
      });
    } catch (err: unknown) {
      this.logger.error('payment.initiated broadcast failed', err);
    }
  }

  @OnEvent(EventNames.PAYMENT_SUCCEEDED, { async: true })
  onPaymentSucceeded(payload: PaymentSucceededPayload): void {
    try {
      this.broadcastService.broadcastPaymentEvent(payload.productId, {
        type: 'payment.succeeded',
        productId: payload.productId,
        paymentId: payload.paymentId,
        referenceLabel: payload.referenceLabel,
        winnerUserId: payload.winnerUserId,
        fonepayTraceId: payload.fonepayTraceId,
        amount: payload.amount,
      });
    } catch (err: unknown) {
      this.logger.error('payment.succeeded broadcast failed', err);
    }
  }

  @OnEvent(EventNames.PAYMENT_FAILED, { async: true })
  onPaymentFailed(payload: PaymentFailedPayload): void {
    try {
      this.broadcastService.broadcastPaymentEvent(payload.productId, {
        type: 'payment.failed',
        productId: payload.productId,
        paymentId: payload.paymentId,
        referenceLabel: payload.referenceLabel,
        winnerUserId: payload.winnerUserId,
        message: payload.message,
      });
    } catch (err: unknown) {
      this.logger.error('payment.failed broadcast failed', err);
    }
  }

  @OnEvent(EventNames.WIN_TRANSFERRED, { async: true })
  onWinTransferred(payload: WinTransferredPayload): void {
    try {
      this.broadcastService.broadcastPaymentEvent(payload.productId, {
        type: 'win.transferred',
        productId: payload.productId,
        fromUserId: payload.fromUserId,
        toUserId: payload.toUserId,
        newPaymentDeadline: payload.newPaymentDeadline,
      });
    } catch (err: unknown) {
      this.logger.error('win.transferred broadcast failed', err);
    }
  }
}
