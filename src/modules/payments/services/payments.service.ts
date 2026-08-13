import { PaymentStatus } from '@common/enums/payment-status.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';
import { EventNames } from '@common/events/event-names';
import type {
  PaymentFailedPayload,
  PaymentInitiatedPayload,
  PaymentSucceededPayload,
} from '@common/events/event-payloads.type';
import { Bid } from '@modules/bidding/entities/bid.entity';
import { AuctionLifecycleService } from '@modules/bidding/services/auction-lifecycle.service';
import type { FonepayPaymentStatusResponse } from '@modules/fonepay/dto/fonepay.dto';
import { FonepayClientService } from '@modules/fonepay/services/fonepay-client.service';
import { Product } from '@modules/products/entities/product.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { WebSocket } from 'ws';
import type {
  InitiatePaymentResponseDto,
  PaymentStatusResponseDto,
} from '../dto/payment.dto';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  // Per-payment Fonepay WebSocket connections. Single-instance only.
  // TODO: move socket ownership to a shared queue (e.g. BullMQ) when horizontally scaled.
  private readonly activeSockets = new Map<string, WebSocket>();
  // Reconnect attempt counters per paymentId
  private readonly reconnectAttempts = new Map<string, number>();
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly fonepayClientService: FonepayClientService,
    private readonly auctionLifecycleService: AuctionLifecycleService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  private resolveDeliveryCharge(zone: DeliveryZone): number {
    const key =
      zone === DeliveryZone.INSIDE_VALLEY
        ? 'DELIVERY_CHARGE_INSIDE_VALLEY'
        : 'DELIVERY_CHARGE_OUTSIDE_VALLEY';
    return this.configService.getOrThrow<number>(key);
  }

  // On startup, reconnect any PENDING payments whose sockets were lost on restart.
  async onModuleInit(): Promise<void> {
    try {
      const pendingPayments = await this.paymentRepo.find({
        where: { status: PaymentStatus.PENDING },
      });

      const now = new Date();
      let reconnected = 0;

      for (const payment of pendingPayments) {
        if (payment.websocketUrl && payment.paymentDeadline > now) {
          this.openFonepaySocket(payment);
          reconnected++;
        }
      }

      if (reconnected > 0) {
        this.logger.log(
          `onModuleInit: reconnected ${reconnected} in-flight payment socket(s)`,
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        'onModuleInit: failed to reconnect pending payment sockets',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async initiatePayment(
    productId: string,
    requestingUserId: string,
    deliveryZone: DeliveryZone,
  ): Promise<InitiatePaymentResponseDto> {
    // Load product and verify it's in the right state
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (product.status !== ProductStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        `Product is not awaiting payment (status: ${product.status})`,
      );
    }

    // Find the currently responsible bid
    const responsibleBid = await this.bidRepo.findOne({
      where: { productId, isCurrentlyPaymentResponsible: true },
    });

    if (!responsibleBid) {
      throw new BadRequestException(
        'No active payment window found for this product',
      );
    }

    // Authorise: only the responsible bidder may initiate
    if (responsibleBid.bidderId !== requestingUserId) {
      throw new ForbiddenException(
        'You are not the current winner for this product',
      );
    }

    // Check the deadline
    const now = new Date();
    if (
      !responsibleBid.paymentDeadline ||
      responsibleBid.paymentDeadline <= now
    ) {
      throw new BadRequestException('Your payment window has expired');
    }

    // Guard: return an existing PENDING payment if it has a valid (non-expired) QR
    const existingPending = await this.paymentRepo.findOne({
      where: {
        productId,
        winnerUserId: requestingUserId,
        status: PaymentStatus.PENDING,
      },
    });
    if (
      existingPending &&
      existingPending.paymentDeadline > now &&
      existingPending.qrString
    ) {
      this.logger.debug(
        `initiatePayment: returning existing PENDING payment ${existingPending.id}`,
      );
      return this.toInitiateResponse(existingPending);
    }

    // Guard: reject if this product already has a SUCCESS payment
    const successPayment = await this.paymentRepo.findOne({
      where: { productId, status: PaymentStatus.SUCCESS },
    });
    if (successPayment) {
      throw new ConflictException('This product has already been paid for');
    }

    // Generate a unique referenceLabel with collision retry
    const referenceLabel = await this.generateUniqueReferenceLabel();

    // Call Fonepay to generate the QR
    const qrResult = await this.fonepayClientService.generateIntentQr({
      amount: Number(product.currentHighestBid ?? responsibleBid.amount),
      billId: product.id,
      referenceLabel,
    });

    // Persist the Payment row
    const payment = this.paymentRepo.create({
      productId,
      winnerUserId: requestingUserId,
      amount: Number(responsibleBid.amount),
      referenceLabel,
      terminalId: qrResult.terminalId,
      qrString: qrResult.qrString,
      qrMessage: qrResult.qrMessage,
      websocketUrl: qrResult.websocketUrl,
      status: PaymentStatus.PENDING,
      paymentDeadline: responsibleBid.paymentDeadline,
      deliveryZone,
      deliveryCharge: this.resolveDeliveryCharge(deliveryZone),
    });

    const saved = await this.paymentRepo.save(payment);

    // Open the backend-held Fonepay WebSocket for this transaction
    if (saved.websocketUrl) {
      this.openFonepaySocket(saved);
    }

    // Emit payment.initiated for SSE relay
    const initiatedPayload: PaymentInitiatedPayload = {
      productId,
      paymentId: saved.id,
      referenceLabel,
      winnerUserId: requestingUserId,
    };
    this.eventEmitter.emit(EventNames.PAYMENT_INITIATED, initiatedPayload);

    return this.toInitiateResponse(saved);
  }

  async confirmSuccess(
    paymentId: string,
    statusResult?: FonepayPaymentStatusResponse,
  ): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) return;
    if (payment.status === PaymentStatus.SUCCESS) return; // idempotent

    // Settle the product via the auction lifecycle (has its own transaction)
    try {
      await this.auctionLifecycleService.confirmPaymentGateway(
        payment.productId,
      );
    } catch (err: unknown) {
      // If product is already SETTLED (parallel admin confirmation or duplicate WS message)
      // we still want to mark this Payment as SUCCESS.
      const isAlreadySettled =
        err instanceof BadRequestException && err.message.includes('SETTLED');

      if (!isAlreadySettled) {
        this.logger.error(
          `confirmSuccess: confirmPaymentGateway failed for payment ${paymentId}`,
          err instanceof Error ? err.stack : String(err),
        );
        // Don't mark the Payment SUCCESS if we couldn't settle the product
        return;
      }
    }

    // Update Payment row to SUCCESS
    await this.paymentRepo.update(paymentId, {
      status: PaymentStatus.SUCCESS,
      fonepayTraceId: statusResult?.fonepayTraceId ?? null,
      paymentMessage: statusResult?.paymentMessage ?? null,
    });

    this.closeSocket(paymentId);

    const succeededPayload: PaymentSucceededPayload = {
      productId: payment.productId,
      paymentId,
      referenceLabel: payment.referenceLabel,
      winnerUserId: payment.winnerUserId,
      fonepayTraceId: statusResult?.fonepayTraceId ?? null,
      amount: Number(payment.amount),
    };
    this.eventEmitter.emit(EventNames.PAYMENT_SUCCEEDED, succeededPayload);
  }

  async markFailed(paymentId: string, message: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) return;
    if (payment.status === PaymentStatus.FAILED) return; // idempotent

    await this.paymentRepo.update(paymentId, {
      status: PaymentStatus.FAILED,
      paymentMessage: message,
    });

    this.closeSocket(paymentId);

    const failedPayload: PaymentFailedPayload = {
      productId: payment.productId,
      paymentId,
      referenceLabel: payment.referenceLabel,
      winnerUserId: payment.winnerUserId,
      message,
    };
    this.eventEmitter.emit(EventNames.PAYMENT_FAILED, failedPayload);
  }

  async getStatus(
    productId: string,
    requestingUserId: string,
  ): Promise<PaymentStatusResponseDto> {
    // Find the latest Payment for this product + winner
    const payment = await this.paymentRepo.findOne({
      where: { productId, winnerUserId: requestingUserId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException('No payment found for this product');
    }

    // If PENDING, reconcile with Fonepay
    if (payment.status === PaymentStatus.PENDING) {
      try {
        const fonepayStatus = await this.fonepayClientService.getPaymentStatus({
          referenceLabel: payment.referenceLabel,
        });

        if (fonepayStatus.paymentStatus === 'success') {
          await this.confirmSuccess(payment.id, fonepayStatus);
          // Re-fetch after update
          const updated = await this.paymentRepo.findOne({
            where: { id: payment.id },
          });
          return this.toStatusResponse(updated ?? payment);
        } else if (fonepayStatus.paymentStatus === 'failed') {
          await this.markFailed(payment.id, fonepayStatus.paymentMessage);
          const updated = await this.paymentRepo.findOne({
            where: { id: payment.id },
          });
          return this.toStatusResponse(updated ?? payment);
        }
      } catch (err: unknown) {
        // Fonepay unavailable — return current cached state
        this.logger.warn(
          `getStatus: Fonepay status check failed for payment ${payment.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return this.toStatusResponse(payment);
  }

  // Called by PaymentsCron to mark an expired PENDING payment
  async expirePayment(paymentId: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    await this.paymentRepo.update(paymentId, { status: PaymentStatus.EXPIRED });
    this.closeSocket(paymentId);
    this.logger.log(`expirePayment: payment ${paymentId} marked EXPIRED`);
  }

  // ─── Fonepay WebSocket management ─────────────────────────────────────────

  private openFonepaySocket(payment: Payment, attempt = 0): void {
    if (!payment.websocketUrl) return;

    this.reconnectAttempts.set(payment.id, attempt);
    const ws = new WebSocket(payment.websocketUrl);
    this.activeSockets.set(payment.id, ws);

    ws.on('open', () => {
      this.logger.debug(`WS open: payment ${payment.id} (attempt ${attempt})`);
      this.reconnectAttempts.delete(payment.id);
    });

    ws.on('message', (data: Buffer) => {
      void (async () => {
        try {
          const outer = JSON.parse(data.toString()) as {
            merchantId: string;
            deviceId: string;
            transactionStatus: string;
          };

          // Inner transactionStatus is a stringified JSON; parse it but don't trust it.
          // Always verify via the status API.
          try {
            JSON.parse(outer.transactionStatus);
          } catch {
            // Non-JSON message — still run the status check
          }

          this.logger.debug(
            `WS message for payment ${payment.id}: verifying with Fonepay status API`,
          );

          const status = await this.fonepayClientService.getPaymentStatus({
            referenceLabel: payment.referenceLabel,
          });

          if (status.paymentStatus === 'success') {
            await this.confirmSuccess(payment.id, status);
          } else if (status.paymentStatus === 'failed') {
            await this.markFailed(payment.id, status.paymentMessage);
          }
          // 'pending' → ignore, keep the socket open and wait
        } catch (err: unknown) {
          this.logger.error(
            `WS message error for payment ${payment.id}`,
            err instanceof Error ? err.message : String(err),
          );
        }
      })();
    });

    ws.on('error', (err: Error) => {
      this.logger.warn(`WS error for payment ${payment.id}: ${err.message}`);
    });

    ws.on('close', () => {
      void (async () => {
        this.activeSockets.delete(payment.id);
        this.logger.debug(`WS closed: payment ${payment.id}`);

        // Reconnect only if still PENDING and within deadline
        const fresh = await this.paymentRepo
          .findOne({ where: { id: payment.id } })
          .catch(() => null);
        if (!fresh || fresh.status !== PaymentStatus.PENDING) return;
        if (fresh.paymentDeadline <= new Date()) return;

        const nextAttempt =
          (this.reconnectAttempts.get(payment.id) ?? attempt) + 1;
        if (nextAttempt > PaymentsService.MAX_RECONNECT_ATTEMPTS) {
          this.logger.warn(
            `WS reconnect limit reached for payment ${payment.id}`,
          );
          return;
        }

        const delay = Math.min(1_000 * Math.pow(2, nextAttempt - 1), 30_000);
        this.logger.debug(
          `WS scheduling reconnect in ${delay}ms for payment ${payment.id}`,
        );
        setTimeout(() => this.openFonepaySocket(fresh, nextAttempt), delay);
      })();
    });
  }

  private closeSocket(paymentId: string): void {
    const ws = this.activeSockets.get(paymentId);
    if (ws) {
      ws.removeAllListeners();
      ws.close();
      this.activeSockets.delete(paymentId);
    }
    this.reconnectAttempts.delete(paymentId);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async generateUniqueReferenceLabel(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = crypto.randomBytes(22);
      let label = '';
      for (let i = 0; i < 22; i++) {
        label += chars[bytes[i] % chars.length];
      }
      // Verify uniqueness before using
      const exists = await this.paymentRepo.findOne({
        where: { referenceLabel: label },
      });
      if (!exists) return label;
    }
    throw new Error(
      'Failed to generate a unique referenceLabel after 5 attempts',
    );
  }

  private toInitiateResponse(p: Payment): InitiatePaymentResponseDto {
    return {
      paymentId: p.id,
      referenceLabel: p.referenceLabel,
      amount: Number(p.amount),
      qrString: p.qrString ?? '',
      qrMessage: p.qrMessage ?? '',
      status: p.status,
      paymentDeadline: p.paymentDeadline.toISOString(),
    };
  }

  private toStatusResponse(p: Payment): PaymentStatusResponseDto {
    return {
      paymentId: p.id,
      referenceLabel: p.referenceLabel,
      amount: Number(p.amount),
      status: p.status,
      paymentDeadline: p.paymentDeadline.toISOString(),
      fonepayTraceId: p.fonepayTraceId,
      paymentMessage: p.paymentMessage,
    };
  }
}
