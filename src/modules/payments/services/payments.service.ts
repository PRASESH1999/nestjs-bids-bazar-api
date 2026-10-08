import { PaymentStatus } from '@common/enums/payment-status.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { EventNames } from '@common/events/event-names';
import type {
  PaymentFailedPayload,
  PaymentInitiatedPayload,
  PaymentSucceededPayload,
} from '@common/events/event-payloads.type';
import { Bid } from '@modules/bidding/entities/bid.entity';
import { ProductSettlement } from '@modules/bidding/entities/product-settlement.entity';
import { AuctionLifecycleService } from '@modules/bidding/services/auction-lifecycle.service';
import { StaleSettlementRoundException } from '@modules/bidding/stale-settlement-round.exception';
import type { FonepayPaymentStatusResponse } from '@modules/fonepay/dto/fonepay.dto';
import { FonepayClientService } from '@modules/fonepay/services/fonepay-client.service';
import { PathaoClientService } from '@modules/pathao/services/pathao-client.service';
import { ProductDeliveriesService } from '@modules/pathao/services/product-deliveries.service';
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
import { DataSource, Not, Repository } from 'typeorm';
import { WebSocket } from 'ws';
import { PaginatedResult } from '@common/types/paginated-result.type';
import type {
  InitiatePaymentDto,
  InitiatePaymentResponseDto,
  PaymentShippingAddressView,
  PaymentStatusResponseDto,
} from '../dto/payment.dto';
import {
  ListPaymentsAdminQueryDto,
  SortOrder,
} from '../dto/list-payments-admin.query.dto';
import { ProductPayment } from '../entities/product-payment.entity';
import { ShippingService } from '@modules/shipping/shipping.service';

// Refund reasons written to `paymentMessage` by flagForRefund. All start with
// "REFUND DUE" — that prefix is what the admin payment records look for.
const REFUND_SETTLED_ELSEWHERE =
  'REFUND DUE — paid after this sale was already settled by another payment';
const REFUND_WINDOW_CLOSED =
  'REFUND DUE — paid after this payment window had closed; nothing was sold';
const REFUND_ROUND_SUPERSEDED =
  'REFUND DUE — paid after this round had ended (the win moved to another bidder, or the Instant Buy hold lapsed); nothing was sold';

// How long after its deadline an EXPIRED attempt is still re-checked with
// Fonepay when the buyer asks for its status. A QR stays payable in the
// buyer's banking app after we stop listening, so a late payment is only
// discovered by asking. See getStatus and OPEN-ITEMS A55.
const LATE_PAYMENT_RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    @InjectRepository(ProductPayment)
    private readonly paymentRepo: Repository<ProductPayment>,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductSettlement)
    private readonly settlementRepo: Repository<ProductSettlement>,
    private readonly dataSource: DataSource,
    private readonly fonepayClientService: FonepayClientService,
    private readonly auctionLifecycleService: AuctionLifecycleService,
    private readonly shippingService: ShippingService,
    private readonly pathaoClientService: PathaoClientService,
    private readonly productDeliveriesService: ProductDeliveriesService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  private resolveDeliveryCharge(): number {
    return this.configService.getOrThrow<number>('DELIVERY_CHARGE_FLAT');
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
    dto: InitiatePaymentDto,
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

    // Resolve the settlement round this attempt belongs to — stamped onto
    // the ProductPayment row so a later gateway confirmation can verify it's
    // still for the currently-active round, not a stale/superseded one.
    const activeSettlement = await this.settlementRepo.findOne({
      where: { productId, bidId: responsibleBid.id },
    });
    if (!activeSettlement) {
      throw new BadRequestException(
        'No active settlement round found for this product',
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

    return this.createQrPayment(
      product,
      responsibleBid,
      activeSettlement,
      requestingUserId,
      dto.shippingAddressId,
    );
  }

  /**
   * Starts an Instant Buy payment hold (pauses bidding — see
   * AuctionLifecycleService.startInstantBuyHold) and immediately generates
   * the Fonepay QR for it. The hold only ever exists alongside an actual
   * in-flight payment attempt; there is no separate "reserve, decide later"
   * step, since the whole point is to tie the short pause to real payment
   * time (Rule 14 addendum).
   *
   * If QR generation fails right after the hold is created, the hold is
   * released immediately — see the catch below — instead of leaving every
   * other bidder locked out for the rest of the (now pointless) hold window.
   */
  async initiateInstantBuyPayment(
    productId: string,
    requestingUserId: string,
    dto: InitiatePaymentDto,
  ): Promise<InitiatePaymentResponseDto> {
    const now = new Date();

    // Idempotent retry: a slow first response re-submitted by the client
    // should get back the same QR, not a second hold attempt that would
    // immediately fail AuctionLifecycleService's own duplicate-hold guard.
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
        `initiateInstantBuyPayment: returning existing PENDING payment ${existingPending.id}`,
      );
      return this.toInitiateResponse(existingPending);
    }

    const { product, bid, settlement } =
      await this.auctionLifecycleService.startInstantBuyHold(
        productId,
        requestingUserId,
      );

    try {
      return await this.createQrPayment(
        product,
        bid,
        settlement,
        requestingUserId,
        dto.shippingAddressId,
      );
    } catch (err: unknown) {
      this.logger.error(
        `initiateInstantBuyPayment: QR generation failed after the hold was created for product ${productId} — releasing`,
        err instanceof Error ? err.stack : String(err),
      );
      try {
        await this.auctionLifecycleService.releaseInstantBuyHold(productId);
      } catch (releaseErr: unknown) {
        this.logger.error(
          `initiateInstantBuyPayment: releaseInstantBuyHold also failed for product ${productId}`,
          releaseErr instanceof Error ? releaseErr.stack : String(releaseErr),
        );
      }
      throw err;
    }
  }

  /**
   * Shared tail of initiatePayment/initiateInstantBuyPayment: resolve and
   * validate the delivery address, generate the Fonepay QR for the
   * responsible bid's amount, and persist the ProductPayment row.
   */
  private async createQrPayment(
    product: Product,
    responsibleBid: Bid,
    settlement: ProductSettlement,
    requestingUserId: string,
    shippingAddressId: string,
  ): Promise<InitiatePaymentResponseDto> {
    // Guard: reject if this product already has a SUCCESS payment
    const successPayment = await this.paymentRepo.findOne({
      where: { productId: product.id, status: PaymentStatus.SUCCESS },
    });
    if (successPayment) {
      throw new ConflictException('This product has already been paid for');
    }

    /*
     * Resolve the destination — required (Rule 14): there is no way to
     * fulfil a sale without a Pathao-resolvable address. `getOwned` scopes
     * the lookup to the caller, so another person's address id is a 404.
     */
    const address = await this.shippingService.getOwned(
      requestingUserId,
      shippingAddressId,
    );
    if (!address.pathaoCityId || !address.pathaoZoneId) {
      throw new BadRequestException(
        'This address has no delivery location set — pick a city/zone before checking out',
      );
    }
    if (!this.pathaoClientService.isServiceable(address.pathaoCityId)) {
      throw new BadRequestException(
        'This delivery address is outside the area we can currently fulfil (Kathmandu Valley only)',
      );
    }

    // Generate a unique referenceLabel with collision retry
    const referenceLabel = await this.generateUniqueReferenceLabel();

    // The responsible bid's own amount is always the authoritative "what do
    // they owe" figure — including after a fallback cascade, where
    // product.currentHighestBid still holds the ORIGINAL (higher) winner's
    // amount rather than the current responsible bidder's lower one.
    const itemAmount = Number(responsibleBid.amount);
    const deliveryCharge = this.resolveDeliveryCharge();

    // Call Fonepay to generate the QR — item + delivery, bundled into one
    // charge (Rule 14). See OPEN-ITEMS A28: this used to be item-only, with
    // delivery collected separately as cash on delivery.
    const qrResult = await this.fonepayClientService.generateIntentQr({
      amount: itemAmount + deliveryCharge,
      billId: product.id,
      referenceLabel,
    });

    // Persist the ProductPayment row. Only the address id + delivery charge
    // are stored here (what the QR was actually generated for, needed later
    // by confirmSuccess) — the frozen recipient/address snapshot lives on
    // ProductDelivery, created only for the attempt that actually succeeds.
    const payment = this.paymentRepo.create({
      productId: product.id,
      productSettlementId: settlement.id,
      sellerId: product.ownerId,
      shippingAddressId: address.id,
      winnerUserId: requestingUserId,
      amount: itemAmount,
      deliveryCharge,
      referenceLabel,
      terminalId: qrResult.terminalId,
      qrString: qrResult.qrString,
      qrMessage: qrResult.qrMessage,
      websocketUrl: qrResult.websocketUrl,
      status: PaymentStatus.PENDING,
      // Non-null: both callers guarantee a live deadline before reaching here
      // — initiatePayment checks it explicitly, startInstantBuyHold always
      // sets one on the hold it just created.
      paymentDeadline: responsibleBid.paymentDeadline!,
    });

    const saved = await this.paymentRepo.save(payment);

    // Open the backend-held Fonepay WebSocket for this transaction
    if (saved.websocketUrl) {
      this.openFonepaySocket(saved);
    }

    // Emit payment.initiated for SSE relay
    const initiatedPayload: PaymentInitiatedPayload = {
      productId: product.id,
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

    /*
     * The gateway says this attempt was paid, but it is no longer the live one
     * — expired by the window, or retired when an admin confirmed the sale
     * manually. The buyer's money moved, so it must not be dropped silently,
     * and it must not settle anything (a second SUCCESS would mean a second
     * delivery and a second seller payout). Record it for a refund instead.
     */
    if (payment.status !== PaymentStatus.PENDING) {
      const reason = (await this.isSettledByAnotherPayment(payment))
        ? REFUND_SETTLED_ELSEWHERE
        : REFUND_WINDOW_CLOSED;
      await this.flagForRefund(payment, statusResult, reason);
      return;
    }

    // Settle the product via the auction lifecycle (has its own transaction).
    // Passing productSettlementId lets confirmPaymentGateway reject this if
    // the win has since moved to a different bidder (stale/superseded QR
    // paid late) instead of incorrectly settling to whoever is currently
    // responsible.
    try {
      await this.auctionLifecycleService.confirmPaymentGateway(
        payment.productId,
        payment.productSettlementId,
        Number(payment.deliveryCharge),
      );
    } catch (err: unknown) {
      /*
       * The round this payment was for is over — the win moved to a fallback
       * bidder before PaymentsCron expired this row (A50), or the Instant Buy
       * hold lapsed and bidding reopened (A55). The money moved and nothing
       * was sold: flag it for a refund rather than only logging, which used to
       * leave the row PENDING for the cron to expire as if it were unpaid.
       */
      if (err instanceof StaleSettlementRoundException) {
        await this.flagForRefund(
          payment,
          statusResult,
          REFUND_ROUND_SUPERSEDED,
        );
        return;
      }

      // If product is already SETTLED (parallel admin confirmation or duplicate WS message)
      // we still want to mark this Payment as SUCCESS.
      const isAlreadySettled =
        err instanceof BadRequestException && err.message.includes('SETTLED');

      // "Already settled" is only benign when *this* payment did the settling
      // (a duplicate socket message racing the first). If a different payment
      // settled the sale, this one is a second charge for the same item.
      if (isAlreadySettled && (await this.isSettledByAnotherPayment(payment))) {
        await this.flagForRefund(
          payment,
          statusResult,
          REFUND_SETTLED_ELSEWHERE,
        );
        return;
      }

      if (!isAlreadySettled) {
        this.logger.error(
          `confirmSuccess: confirmPaymentGateway failed for payment ${paymentId}`,
          err instanceof Error ? err.stack : String(err),
        );
        // Don't mark the Payment SUCCESS if we couldn't settle the product.
        // Left PENDING so a later status check can retry it.
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
      deliveryCharge: Number(payment.deliveryCharge),
      shippingAddressId: payment.shippingAddressId,
    };
    this.eventEmitter.emit(EventNames.PAYMENT_SUCCEEDED, succeededPayload);
  }

  private async isSettledByAnotherPayment(
    payment: ProductPayment,
  ): Promise<boolean> {
    const other = await this.paymentRepo.findOne({
      where: {
        productId: payment.productId,
        status: PaymentStatus.SUCCESS,
        id: Not(payment.id),
      },
    });
    return other !== null;
  }

  /**
   * A gateway payment that was paid but settled nothing — the sale was already
   * settled another way, or the round it belonged to had ended. Marked FAILED
   * with a `reason` that says why, so it shows on the admin payment records
   * for a manual refund — and logged as an error, since money is owed back.
   */
  private async flagForRefund(
    payment: ProductPayment,
    statusResult: FonepayPaymentStatusResponse | undefined,
    reason: string,
  ): Promise<void> {
    await this.paymentRepo.update(payment.id, {
      status: PaymentStatus.FAILED,
      fonepayTraceId: statusResult?.fonepayTraceId ?? null,
      paymentMessage: reason,
    });
    this.closeSocket(payment.id);
    this.logger.error(
      `confirmSuccess: payment ${payment.id} (${payment.referenceLabel}) for product ${payment.productId} settled nothing — ${reason}`,
    );
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

    /*
     * If this was an Instant Buy hold's payment, the hold is now pointless:
     * the buyer cannot pay a FAILED attempt, and the product would otherwise
     * sit paused until the deadline and then count this as their one failed
     * attempt. Release it now, uncounted, so bidding reopens and the buyer
     * may retry (A54). A no-op for anything that isn't the live hold —
     * releaseInstantBuyHold checks the product status and this payment's
     * settlement round itself.
     */
    if (payment.status === PaymentStatus.PENDING) {
      try {
        await this.auctionLifecycleService.releaseInstantBuyHold(
          payment.productId,
          payment.productSettlementId,
        );
      } catch (err: unknown) {
        this.logger.error(
          `markFailed: releasing the Instant Buy hold failed for product ${payment.productId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
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

    // If PENDING, reconcile with Fonepay. A recently EXPIRED attempt is
    // re-checked too: its QR can still be paid after we stopped listening, and
    // asking is the only way to find that out (it is then flagged for a
    // refund by confirmSuccess — A55).
    const recentlyExpired =
      payment.status === PaymentStatus.EXPIRED &&
      Date.now() - payment.paymentDeadline.getTime() <
        LATE_PAYMENT_RECONCILE_WINDOW_MS;
    if (payment.status === PaymentStatus.PENDING || recentlyExpired) {
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
        } else if (
          fonepayStatus.paymentStatus === 'failed' &&
          payment.status === PaymentStatus.PENDING
        ) {
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

    /*
     * Ask Fonepay once before giving up on it. A payment made just before the
     * deadline (or inside the cron gap) whose socket message was missed would
     * otherwise be expired as unpaid with the buyer's money taken. If it was
     * paid, confirmSuccess settles it when its round is still live, or flags
     * it for a refund when it isn't (A50, A55). Fonepay being unreachable must
     * not block expiry, so any error falls through to expiring it.
     */
    try {
      const fonepayStatus = await this.fonepayClientService.getPaymentStatus({
        referenceLabel: payment.referenceLabel,
      });
      if (fonepayStatus.paymentStatus === 'success') {
        await this.confirmSuccess(payment.id, fonepayStatus);
        return;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `expirePayment: Fonepay status check failed for payment ${paymentId}, expiring anyway`,
        err instanceof Error ? err.message : String(err),
      );
    }

    await this.paymentRepo.update(paymentId, { status: PaymentStatus.EXPIRED });
    this.closeSocket(paymentId);
    this.logger.log(`expirePayment: payment ${paymentId} marked EXPIRED`);
  }

  // Called by PaymentEventsHandler on auction.resumed — an Instant Buy hold
  // expired unpaid, so the QR generated for it is now moot. Expires it and
  // closes the socket immediately rather than waiting for PaymentsCron's own
  // 10-minute sweep.
  async expirePendingInstantBuyPayment(
    productId: string,
    winnerUserId: string,
  ): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { productId, winnerUserId, status: PaymentStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    if (!payment) return;
    await this.expirePayment(payment.id);
  }

  // ─── Admin: payment records (includes FAILED/EXPIRED attempts) ────────────

  async listAllPayments(
    query: ListPaymentsAdminQueryDto,
  ): Promise<PaginatedResult<ProductPayment>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder: SortOrder = query.sortOrder ?? SortOrder.DESC;

    const qb = this.paymentRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.winner', 'winner')
      .leftJoinAndSelect('payment.seller', 'seller')
      .leftJoinAndSelect('payment.product', 'product');

    if (query.productId) {
      qb.andWhere('payment.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.winnerUserId) {
      qb.andWhere('payment.winnerUserId = :winnerUserId', {
        winnerUserId: query.winnerUserId,
      });
    }
    if (query.status) {
      qb.andWhere('payment.status = :status', { status: query.status });
    }

    qb.orderBy(`payment.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, meta: { page, limit, total } };
  }

  // ─── Fonepay WebSocket management ─────────────────────────────────────────

  private openFonepaySocket(payment: ProductPayment, attempt = 0): void {
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

  /**
   * Post-success, the recipient/address view comes from the frozen
   * ProductDelivery snapshot (immune to later edits of the saved address).
   * Before success, there's no ProductDelivery row yet, so it falls back to
   * the live saved address the payment points at — the same one it was
   * resolved from at initiation, so this is safe.
   */
  private async buildShippingAddressView(
    p: ProductPayment,
  ): Promise<PaymentShippingAddressView | null> {
    if (p.status === PaymentStatus.SUCCESS) {
      const delivery = await this.productDeliveriesService.findByPaymentId(
        p.id,
      );
      if (!delivery) return null;
      return {
        recipientName: delivery.recipientName,
        recipientPhone: delivery.recipientPhone,
        province: delivery.province,
        district: delivery.district,
        city: delivery.city,
        street: delivery.street,
        wardNumber: delivery.wardNumber,
        landmark: delivery.landmark,
        pathaoCityName: delivery.pathaoCityName,
        pathaoZoneName: delivery.pathaoZoneName,
        pathaoAreaName: delivery.pathaoAreaName,
      };
    }

    if (!p.shippingAddressId) return null;
    try {
      const address = await this.shippingService.getOwned(
        p.winnerUserId,
        p.shippingAddressId,
      );
      return {
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        province: address.province,
        district: address.district,
        city: address.city,
        street: address.street,
        wardNumber: address.wardNumber,
        landmark: address.landmark,
        pathaoCityName: address.pathaoCityName,
        pathaoZoneName: address.pathaoZoneName,
        pathaoAreaName: address.pathaoAreaName,
      };
    } catch {
      // Address was deleted (SET NULL already handles the FK; this covers a
      // race where the lookup runs between deletion and the FK update).
      return null;
    }
  }

  private async toInitiateResponse(
    p: ProductPayment,
  ): Promise<InitiatePaymentResponseDto> {
    const shippingAddress = await this.buildShippingAddressView(p);
    return {
      paymentId: p.id,
      referenceLabel: p.referenceLabel,
      amount: Number(p.amount) + Number(p.deliveryCharge),
      itemAmount: Number(p.amount),
      deliveryCharge: Number(p.deliveryCharge),
      shippingAddress,
      qrString: p.qrString ?? '',
      qrMessage: p.qrMessage ?? '',
      status: p.status,
      paymentDeadline: p.paymentDeadline.toISOString(),
    };
  }

  private async toStatusResponse(
    p: ProductPayment,
  ): Promise<PaymentStatusResponseDto> {
    const [shippingAddress, delivery] = await Promise.all([
      this.buildShippingAddressView(p),
      p.status === PaymentStatus.SUCCESS
        ? this.productDeliveriesService.findBuyerViewByPaymentId(p.id)
        : Promise.resolve(null),
    ]);
    return {
      paymentId: p.id,
      referenceLabel: p.referenceLabel,
      amount: Number(p.amount) + Number(p.deliveryCharge),
      itemAmount: Number(p.amount),
      deliveryCharge: Number(p.deliveryCharge),
      shippingAddress,
      delivery,
      status: p.status,
      paymentDeadline: p.paymentDeadline.toISOString(),
      fonepayTraceId: p.fonepayTraceId,
      paymentMessage: p.paymentMessage,
    };
  }
}
