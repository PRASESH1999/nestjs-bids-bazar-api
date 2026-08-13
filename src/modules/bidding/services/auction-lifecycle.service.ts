import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';
import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';
import { PaymentConfirmationMethod } from '@common/enums/payment-confirmation-method.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';
import { EventNames } from '@common/events/event-names';
import type {
  AuctionClosedPayload,
  AuctionSettledPayload,
} from '@common/events/event-payloads.type';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { MailService } from '@modules/mail/mail.service';
import { Bid } from '../entities/bid.entity';

@Injectable()
export class AuctionLifecycleService {
  private readonly logger = new Logger(AuctionLifecycleService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Core transition: close an active auction whose timer has expired ─────

  async closeIfExpired(
    productId: string,
    externalQueryRunner?: QueryRunner,
  ): Promise<void> {
    const isOwnQr = externalQueryRunner === undefined;
    const qr: QueryRunner =
      externalQueryRunner ?? this.dataSource.createQueryRunner();

    if (isOwnQr) {
      await qr.connect();
      await qr.startTransaction();
    }

    // Captured inside transaction — used for post-commit emails and event emission
    let winnerId: string | null = null;
    let sellerId: string | null = null;
    let winningAmount: number | null = null;
    let paymentDeadline: Date | null = null;
    let capturedProductTitle: string | null = null;
    let capturedProductId: string | null = null;
    let capturedWinningBidId: string | null = null;
    let transitioned = false;

    try {
      const product = await qr.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product || product.status !== ProductStatus.ACTIVE) {
        if (isOwnQr) await qr.commitTransaction();
        return;
      }

      const now = new Date();

      if (!product.biddingEndsAt || product.biddingEndsAt > now) {
        if (isOwnQr) await qr.commitTransaction();
        return;
      }

      const highestBid = await qr.manager
        .getRepository(Bid)
        .createQueryBuilder('bid')
        .where('bid.productId = :productId', { productId })
        .orderBy('bid.amount', 'DESC')
        .addOrderBy('bid.placedAt', 'ASC')
        .getOne();

      if (!highestBid) {
        this.logger.warn(
          `closeIfExpired: ACTIVE product ${productId} has no bids — skipping transition`,
        );
        if (isOwnQr) await qr.commitTransaction();
        return;
      }

      const paymentWindowHours = this.configService.getOrThrow<number>(
        'PAYMENT_WINDOW_HOURS',
      );
      const computedDeadline = new Date(
        now.getTime() + paymentWindowHours * 60 * 60 * 1000,
      );

      highestBid.isOriginalWinner = true;
      highestBid.fallbackRank = 0;
      highestBid.isCurrentlyPaymentResponsible = true;
      highestBid.paymentStatus = BidPaymentStatus.PENDING;
      highestBid.paymentDeadline = computedDeadline;

      product.status = ProductStatus.AWAITING_PAYMENT;
      product.closedAt = now;
      product.winningBidId = highestBid.id;

      await qr.manager.getRepository(Bid).save(highestBid);
      await qr.manager.getRepository(Product).save(product);

      if (isOwnQr) await qr.commitTransaction();

      // Capture state for post-commit emails
      winnerId = highestBid.bidderId;
      sellerId = product.ownerId;
      winningAmount = Number(highestBid.amount);
      paymentDeadline = computedDeadline;
      capturedProductTitle = product.title;
      capturedProductId = product.id;
      capturedWinningBidId = highestBid.id;
      transitioned = true;
    } catch (err: unknown) {
      if (isOwnQr) await qr.rollbackTransaction();
      throw err;
    } finally {
      if (isOwnQr) await qr.release();
    }

    if (!transitioned) return;

    // Post-commit email notifications — failures are non-fatal
    try {
      const [winner, seller] = await Promise.all([
        this.dataSource
          .getRepository(User)
          .findOne({ where: { id: winnerId } }),
        this.dataSource
          .getRepository(User)
          .findOne({ where: { id: sellerId } }),
      ]);

      if (winner) {
        await this.mailService.sendAuctionWon(winner.email, {
          bidderName: winner.name,
          productTitle: capturedProductTitle,
          productId: capturedProductId,
          winningAmount: winningAmount,
          paymentDeadline: paymentDeadline,
        });
      }

      if (seller) {
        await this.mailService.sendAuctionClosedSeller(seller.email, {
          sellerName: seller.name,
          productTitle: capturedProductTitle,
          winningAmount: winningAmount,
          winnerName: winner?.name ?? 'Unknown',
        });
      }
    } catch (err: unknown) {
      this.logger.error(
        `closeIfExpired: post-commit email failed for product ${capturedProductId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // Post-commit event emission — never affects the caller. Failure is
    // logged so a flaky listener never blocks lifecycle progression.
    try {
      const payload: AuctionClosedPayload = {
        productId: capturedProductId,
        winningBidId: capturedWinningBidId,
        winnerId: winnerId,
        winningAmount: winningAmount,
      };
      this.eventEmitter.emit(EventNames.AUCTION_CLOSED, payload);
    } catch (err: unknown) {
      this.logger.error(
        `closeIfExpired: auction.closed emission failed for product ${capturedProductId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ─── Instant Buy: immediate purchase, no fallback chain ────────────────────

  /**
   * Executes an Instant Buy: creates a synthetic winning bid at
   * product.instantBuyPrice, closes the auction immediately, and makes the
   * buyer the SOLE eligible party. Unlike a normal auction win, this never
   * enters the fallback chain — handlePaymentExpiry checks isInstantBuy and
   * goes straight to ABANDONED if this buyer doesn't pay in time.
   */
  async executeInstantBuy(
    productId: string,
    buyerId: string,
  ): Promise<Product> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let winnerId: string | null = null;
    let sellerId: string | null = null;
    let winningAmount: number | null = null;
    let paymentDeadline: Date | null = null;
    let capturedProductTitle: string | null = null;
    let capturedProductId: string | null = null;
    let capturedWinningBidId: string | null = null;
    let savedProduct: Product;

    try {
      const product = await qr.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      if (
        product.status !== ProductStatus.PENDING &&
        product.status !== ProductStatus.ACTIVE
      ) {
        throw new BadRequestException('Product is not open for Instant Buy');
      }

      if (product.ownerId === buyerId) {
        throw new BadRequestException(
          'Owner cannot Instant Buy their own product',
        );
      }

      // Re-validate visibility INSIDE the lock — a concurrent bid could have
      // crossed instantBuyPrice between an earlier (pre-lock) check and now.
      const currentBid = Number(
        product.currentHighestBid ?? product.biddingStartPrice,
      );
      const instantBuyPrice = Number(product.instantBuyPrice);

      if (currentBid >= instantBuyPrice) {
        throw new BadRequestException(
          'Instant Buy is no longer available for this product',
        );
      }

      const existingResponsible = await qr.manager.getRepository(Bid).findOne({
        where: { productId, isCurrentlyPaymentResponsible: true },
      });
      if (existingResponsible) {
        throw new InternalServerErrorException(
          'A payment-responsible bid already exists — data inconsistency',
        );
      }

      const now = new Date();
      const paymentWindowHours = this.configService.getOrThrow<number>(
        'PAYMENT_WINDOW_HOURS',
      );
      const computedDeadline = new Date(
        now.getTime() + paymentWindowHours * 60 * 60 * 1000,
      );

      const instantBid = qr.manager.getRepository(Bid).create({
        productId,
        bidderId: buyerId,
        amount: instantBuyPrice,
        placedAt: now,
        previousHighestAmount: product.currentHighestBid,
        wasFirstBid: product.currentHighestBid === null,
        isOriginalWinner: true,
        isInstantBuy: true,
        fallbackRank: 0,
        isCurrentlyPaymentResponsible: true,
        paymentStatus: BidPaymentStatus.PENDING,
        paymentDeadline: computedDeadline,
      });
      const savedBid = await qr.manager.getRepository(Bid).save(instantBid);

      // No fallback pool: every other bid on this product is permanently
      // NOT_RESPONSIBLE. Instant Buy must never fall back to another bidder,
      // even if this buyer never pays (see handlePaymentExpiry).
      await qr.manager
        .createQueryBuilder()
        .update(Bid)
        .set({ paymentStatus: BidPaymentStatus.NOT_RESPONSIBLE })
        .where('productId = :productId AND id != :id', {
          productId,
          id: savedBid.id,
        })
        .execute();

      product.status = ProductStatus.AWAITING_PAYMENT;
      product.currentHighestBid = instantBuyPrice;
      product.currentHighestBidderId = buyerId;
      if (!product.biddingStartedAt) product.biddingStartedAt = now;
      product.biddingEndsAt = now;
      product.closedAt = now;
      product.winningBidId = savedBid.id;

      savedProduct = await qr.manager.getRepository(Product).save(product);

      await qr.commitTransaction();

      winnerId = buyerId;
      sellerId = product.ownerId;
      winningAmount = instantBuyPrice;
      paymentDeadline = computedDeadline;
      capturedProductTitle = product.title;
      capturedProductId = product.id;
      capturedWinningBidId = savedBid.id;
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Post-commit email notifications — failures are non-fatal. Reuses the
    // same templates as a normal auction win (buyer/seller framing is
    // identical from their point of view).
    try {
      const [winner, seller] = await Promise.all([
        this.dataSource
          .getRepository(User)
          .findOne({ where: { id: winnerId } }),
        this.dataSource
          .getRepository(User)
          .findOne({ where: { id: sellerId } }),
      ]);

      if (winner) {
        await this.mailService.sendAuctionWon(winner.email, {
          bidderName: winner.name,
          productTitle: capturedProductTitle,
          productId: capturedProductId,
          winningAmount: winningAmount,
          paymentDeadline: paymentDeadline,
        });
      }

      if (seller) {
        await this.mailService.sendAuctionClosedSeller(seller.email, {
          sellerName: seller.name,
          productTitle: capturedProductTitle,
          winningAmount: winningAmount,
          winnerName: winner?.name ?? 'Unknown',
        });
      }
    } catch (err: unknown) {
      this.logger.error(
        `executeInstantBuy: post-commit email failed for product ${capturedProductId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // Reuse AUCTION_CLOSED — AuctionClosedHandler re-broadcasts current state,
    // which is exactly what's needed to make showInstantBuy/status flip in
    // real time for connected SSE clients.
    try {
      const payload: AuctionClosedPayload = {
        productId: capturedProductId,
        winningBidId: capturedWinningBidId,
        winnerId: winnerId,
        winningAmount: winningAmount,
      };
      this.eventEmitter.emit(EventNames.AUCTION_CLOSED, payload);
    } catch (err: unknown) {
      this.logger.error(
        `executeInstantBuy: auction.closed emission failed for product ${capturedProductId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return savedProduct;
  }

  // ─── Core transition: expire a payment window and advance the fallback chain

  async handlePaymentExpiry(
    productId: string,
    externalQueryRunner?: QueryRunner,
  ): Promise<void> {
    const isOwnQr = externalQueryRunner === undefined;
    const qr: QueryRunner =
      externalQueryRunner ?? this.dataSource.createQueryRunner();

    if (isOwnQr) {
      await qr.connect();
      await qr.startTransaction();
    }

    // Captured for post-commit emails and events
    let outcome: 'fallback' | 'abandoned' | 'noop' = 'noop';
    let newWinnerId: string | null = null;
    let failedBidderId: string | null = null;
    let sellerId: string | null = null;
    let capturedProductTitle: string | null = null;
    let capturedProductId: string | null = null;
    let newWinnerAmount: number | null = null;
    let newWinnerDeadline: Date | null = null;
    let newWinnerFallbackRank: number | null = null;
    let failedBidderRank: number | null = null;
    let totalBiddersCount: number | null = null;

    try {
      const product = await qr.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product || product.status !== ProductStatus.AWAITING_PAYMENT) {
        if (isOwnQr) await qr.commitTransaction();
        return;
      }

      const responsibleBid = await qr.manager.getRepository(Bid).findOne({
        where: { productId, isCurrentlyPaymentResponsible: true },
      });

      if (!responsibleBid) {
        if (isOwnQr) await qr.commitTransaction();
        return;
      }

      const now = new Date();

      if (
        !responsibleBid.paymentDeadline ||
        responsibleBid.paymentDeadline > now
      ) {
        if (isOwnQr) await qr.commitTransaction();
        return;
      }

      failedBidderRank = responsibleBid.fallbackRank;
      failedBidderId = responsibleBid.bidderId;
      responsibleBid.paymentStatus = BidPaymentStatus.EXPIRED;
      responsibleBid.isCurrentlyPaymentResponsible = false;

      // Instant Buy never falls back to another bidder — the auction closed
      // to exactly one buyer at click time, even if other (now
      // NOT_RESPONSIBLE) bids exist below it. Skip the fallback search
      // entirely and go straight to ABANDONED.
      const nextBid = responsibleBid.isInstantBuy
        ? null
        : await qr.manager
            .getRepository(Bid)
            .createQueryBuilder('bid')
            .where(
              'bid.productId = :productId AND bid.paymentStatus = :status AND bid.id != :id',
              {
                productId,
                status: BidPaymentStatus.NOT_RESPONSIBLE,
                id: responsibleBid.id,
              },
            )
            .orderBy('bid.amount', 'DESC')
            .addOrderBy('bid.placedAt', 'ASC')
            .getOne();

      if (nextBid) {
        const paymentWindowHours = this.configService.getOrThrow<number>(
          'PAYMENT_WINDOW_HOURS',
        );
        const computedDeadline = new Date(
          now.getTime() + paymentWindowHours * 60 * 60 * 1000,
        );

        nextBid.fallbackRank = responsibleBid.fallbackRank + 1;
        nextBid.isCurrentlyPaymentResponsible = true;
        nextBid.paymentStatus = BidPaymentStatus.PENDING;
        nextBid.paymentDeadline = computedDeadline;

        await qr.manager.getRepository(Bid).save(responsibleBid);
        await qr.manager.getRepository(Bid).save(nextBid);

        if (isOwnQr) await qr.commitTransaction();

        outcome = 'fallback';
        newWinnerId = nextBid.bidderId;
        sellerId = product.ownerId;
        newWinnerAmount = Number(nextBid.amount);
        newWinnerDeadline = computedDeadline;
        newWinnerFallbackRank = nextBid.fallbackRank;
        capturedProductTitle = product.title;
        capturedProductId = product.id;
      } else {
        product.status = ProductStatus.ABANDONED;
        product.abandonedAt = now;

        await qr.manager.getRepository(Bid).save(responsibleBid);
        await qr.manager.getRepository(Product).save(product);

        if (isOwnQr) await qr.commitTransaction();

        outcome = 'abandoned';
        sellerId = product.ownerId;
        capturedProductTitle = product.title;
        capturedProductId = product.id;

        // Count total unique bidders for the abandonment email
        totalBiddersCount = await this.dataSource
          .getRepository(Bid)
          .createQueryBuilder('bid')
          .select('COUNT(DISTINCT bid.bidderId)', 'cnt')
          .where('bid.productId = :productId', { productId })
          .getRawOne<{ cnt: string }>()
          .then((row) => parseInt(row?.cnt ?? '0', 10));
      }
    } catch (err: unknown) {
      if (isOwnQr) await qr.rollbackTransaction();
      throw err;
    } finally {
      if (isOwnQr) await qr.release();
    }

    // Post-commit email notifications — failures are non-fatal
    try {
      if (outcome === 'fallback') {
        const [newWinner, seller] = await Promise.all([
          this.dataSource
            .getRepository(User)
            .findOne({ where: { id: newWinnerId! } }),
          this.dataSource
            .getRepository(User)
            .findOne({ where: { id: sellerId } }),
        ]);

        if (newWinner) {
          await this.mailService.sendPaymentFailedFallback(newWinner.email, {
            bidderName: newWinner.name,
            productTitle: capturedProductTitle,
            productId: capturedProductId,
            winningAmount: newWinnerAmount!,
            paymentDeadline: newWinnerDeadline!,
            fallbackRank: newWinnerFallbackRank!,
          });
        }

        if (seller) {
          await this.mailService.sendPaymentFailedSeller(seller.email, {
            sellerName: seller.name,
            productTitle: capturedProductTitle,
            failedBidderRank: failedBidderRank,
            newWinnerName: newWinner?.name ?? 'Unknown',
            newWinnerBidAmount: newWinnerAmount!,
          });
        }
      } else {
        // outcome === 'abandoned'
        const seller = await this.dataSource
          .getRepository(User)
          .findOne({ where: { id: sellerId } });

        if (seller) {
          await this.mailService.sendAuctionAbandoned(seller.email, {
            sellerName: seller.name,
            productTitle: capturedProductTitle,
            totalBidders: totalBiddersCount ?? 0,
          });
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `handlePaymentExpiry: post-commit email failed for product ${capturedProductId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // Emit WIN_TRANSFERRED so SSE subscribers (and the PaymentsModule handler)
    // learn the win moved to a new bidder. Non-fatal — never blocks the expiry flow.
    if (outcome === 'fallback') {
      try {
        this.eventEmitter.emit(EventNames.WIN_TRANSFERRED, {
          productId: capturedProductId,
          fromUserId: failedBidderId,
          toUserId: newWinnerId,
          newPaymentDeadline: newWinnerDeadline!.toISOString(),
        });
      } catch (err: unknown) {
        this.logger.error(
          `handlePaymentExpiry: win.transferred emission failed for product ${capturedProductId}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  // ─── Admin-initiated payment confirmation ─────────────────────────────────

  private resolveDeliveryCharge(zone: DeliveryZone): number {
    const key =
      zone === DeliveryZone.INSIDE_VALLEY
        ? 'DELIVERY_CHARGE_INSIDE_VALLEY'
        : 'DELIVERY_CHARGE_OUTSIDE_VALLEY';
    return this.configService.getOrThrow<number>(key);
  }

  // Mirrors PaymentsService.generateUniqueReferenceLabel — duplicated locally
  // rather than injecting PaymentsService here, which would create a circular
  // dependency (PaymentsService already depends on AuctionLifecycleService).
  private async generateManualReferenceLabel(qr: QueryRunner): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = crypto.randomBytes(22);
      let label = '';
      for (let i = 0; i < 22; i++) {
        label += chars[bytes[i] % chars.length];
      }
      const exists = await qr.manager
        .getRepository(Payment)
        .findOne({ where: { referenceLabel: label } });
      if (!exists) return label;
    }
    throw new Error(
      'Failed to generate a unique referenceLabel after 5 attempts',
    );
  }

  async confirmPaymentManual(
    adminId: string,
    productId: string,
    deliveryZone: DeliveryZone,
  ): Promise<Product> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let sellerId: string | null = null;
    let buyerId: string | null = null;
    let confirmedAmount: number | null = null;
    let capturedProductTitle: string | null = null;
    let capturedWinningBidId: string | null = null;
    let savedProduct: Product;

    try {
      const product = await qr.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      if (product.status !== ProductStatus.AWAITING_PAYMENT) {
        throw new BadRequestException('Product is not awaiting payment');
      }

      const responsibleBid = await qr.manager.getRepository(Bid).findOne({
        where: { productId, isCurrentlyPaymentResponsible: true },
      });

      if (!responsibleBid) {
        throw new InternalServerErrorException(
          'No responsible bid found — data inconsistency',
        );
      }

      const now = new Date();

      responsibleBid.paymentStatus = BidPaymentStatus.CONFIRMED;
      responsibleBid.paymentConfirmedAt = now;
      responsibleBid.paymentConfirmedById = adminId;
      responsibleBid.paymentConfirmationMethod =
        PaymentConfirmationMethod.ADMIN_MANUAL;

      product.status = ProductStatus.SETTLED;
      product.settledAt = now;

      await qr.manager.getRepository(Bid).save(responsibleBid);

      // Mark all other bids on this product as NOT_RESPONSIBLE (clean final state).
      await qr.manager
        .createQueryBuilder()
        .update(Bid)
        .set({ paymentStatus: BidPaymentStatus.NOT_RESPONSIBLE })
        .where('productId = :productId AND id != :id', {
          productId,
          id: responsibleBid.id,
        })
        .execute();

      savedProduct = await qr.manager.getRepository(Product).save(product);

      // Create a matching Payment/settlement record so this sale flows
      // through the same seller-settlement + points/commission pipeline as
      // a gateway-paid sale (RewardsModule queries Payment for pending
      // settlements — this path has no Fonepay-generated Payment row
      // otherwise). sellerPaidAt stays null: settlement-to-seller is a
      // separate, later admin action (see RewardsService.markSellerPaid).
      const referenceLabel = await this.generateManualReferenceLabel(qr);
      const manualPayment = qr.manager.getRepository(Payment).create({
        productId,
        winnerUserId: responsibleBid.bidderId,
        amount: Number(responsibleBid.amount),
        referenceLabel,
        terminalId: 'ADMIN-MANUAL',
        qrString: null,
        qrMessage: null,
        websocketUrl: null,
        status: PaymentStatus.SUCCESS,
        paymentDeadline: responsibleBid.paymentDeadline ?? now,
        deliveryZone,
        deliveryCharge: this.resolveDeliveryCharge(deliveryZone),
      });
      await qr.manager.getRepository(Payment).save(manualPayment);

      await qr.commitTransaction();

      // Capture for post-commit emails and event emission
      sellerId = product.ownerId;
      buyerId = responsibleBid.bidderId;
      confirmedAmount = Number(responsibleBid.amount);
      capturedProductTitle = product.title;
      capturedWinningBidId = responsibleBid.id;
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Post-commit email notifications — failures are non-fatal
    try {
      const [seller, buyer] = await Promise.all([
        this.dataSource
          .getRepository(User)
          .findOne({ where: { id: sellerId } }),
        this.dataSource.getRepository(User).findOne({ where: { id: buyerId } }),
      ]);

      if (seller) {
        await this.mailService.sendPaymentConfirmedSeller(seller.email, {
          sellerName: seller.name,
          productTitle: capturedProductTitle,
          amount: confirmedAmount,
          buyerName: buyer?.name ?? 'Unknown',
        });
      }

      if (buyer) {
        await this.mailService.sendPaymentConfirmedBuyer(buyer.email, {
          buyerName: buyer.name,
          productTitle: capturedProductTitle,
          amount: confirmedAmount,
        });
      }
    } catch (err: unknown) {
      this.logger.error(
        `confirmPaymentManual: post-commit email failed for product ${productId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // Post-commit event emission — never affects the caller. Failure is
    // logged so a flaky listener never blocks the admin confirmation flow.
    try {
      const payload: AuctionSettledPayload = {
        productId,
        winningBidId: capturedWinningBidId,
        buyerId: buyerId,
        amount: confirmedAmount,
      };
      this.eventEmitter.emit(EventNames.AUCTION_SETTLED, payload);
    } catch (err: unknown) {
      this.logger.error(
        `confirmPaymentManual: auction.settled emission failed for product ${productId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return savedProduct;
  }

  // ─── Gateway-initiated payment confirmation (Fonepay) ─────────────────────

  /**
   * Settle a product after a Fonepay payment is confirmed programmatically.
   * Identical to confirmPaymentManual but uses BANK_API as the confirmation
   * method and leaves paymentConfirmedById null (no human admin).
   *
   * Throws BadRequestException if the product is not in AWAITING_PAYMENT status
   * (callers should handle this as a no-op if the product is already SETTLED).
   */
  async confirmPaymentGateway(productId: string): Promise<Product> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let sellerId: string | null = null;
    let buyerId: string | null = null;
    let confirmedAmount: number | null = null;
    let capturedProductTitle: string | null = null;
    let capturedWinningBidId: string | null = null;
    let savedProduct: Product;

    try {
      const product = await qr.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      if (product.status !== ProductStatus.AWAITING_PAYMENT) {
        throw new BadRequestException(
          `Product is not awaiting payment (status: ${product.status})`,
        );
      }

      const responsibleBid = await qr.manager.getRepository(Bid).findOne({
        where: { productId, isCurrentlyPaymentResponsible: true },
      });

      if (!responsibleBid) {
        throw new InternalServerErrorException(
          'No responsible bid found — data inconsistency',
        );
      }

      const now = new Date();

      responsibleBid.paymentStatus = BidPaymentStatus.CONFIRMED;
      responsibleBid.paymentConfirmedAt = now;
      responsibleBid.paymentConfirmedById = null;
      responsibleBid.paymentConfirmationMethod =
        PaymentConfirmationMethod.BANK_API;

      product.status = ProductStatus.SETTLED;
      product.settledAt = now;

      await qr.manager.getRepository(Bid).save(responsibleBid);

      await qr.manager
        .createQueryBuilder()
        .update(Bid)
        .set({ paymentStatus: BidPaymentStatus.NOT_RESPONSIBLE })
        .where('productId = :productId AND id != :id', {
          productId,
          id: responsibleBid.id,
        })
        .execute();

      savedProduct = await qr.manager.getRepository(Product).save(product);

      await qr.commitTransaction();

      sellerId = product.ownerId;
      buyerId = responsibleBid.bidderId;
      confirmedAmount = Number(responsibleBid.amount);
      capturedProductTitle = product.title;
      capturedWinningBidId = responsibleBid.id;
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Post-commit emails — reuse the same templates as manual confirmation
    try {
      const [seller, buyer] = await Promise.all([
        this.dataSource
          .getRepository(User)
          .findOne({ where: { id: sellerId } }),
        this.dataSource.getRepository(User).findOne({ where: { id: buyerId } }),
      ]);

      if (seller) {
        await this.mailService.sendPaymentConfirmedSeller(seller.email, {
          sellerName: seller.name,
          productTitle: capturedProductTitle,
          amount: confirmedAmount,
          buyerName: buyer?.name ?? 'Unknown',
        });
      }

      if (buyer) {
        await this.mailService.sendPaymentConfirmedBuyer(buyer.email, {
          buyerName: buyer.name,
          productTitle: capturedProductTitle,
          amount: confirmedAmount,
        });
      }
    } catch (err: unknown) {
      this.logger.error(
        `confirmPaymentGateway: post-commit email failed for product ${productId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // Emit AUCTION_SETTLED so AuctionSettledHandler broadcasts the SSE update
    try {
      const payload: AuctionSettledPayload = {
        productId,
        winningBidId: capturedWinningBidId,
        buyerId,
        amount: confirmedAmount,
      };
      this.eventEmitter.emit(EventNames.AUCTION_SETTLED, payload);
    } catch (err: unknown) {
      this.logger.error(
        `confirmPaymentGateway: auction.settled emission failed for product ${productId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return savedProduct;
  }

  // ─── Cron-friendly batch helpers ─────────────────────────────────────────

  async closeAllExpiredAuctions(): Promise<{
    processed: number;
    errors: number;
  }> {
    const expiredProducts = await this.dataSource
      .getRepository(Product)
      .createQueryBuilder('product')
      .where('product.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('product.biddingEndsAt <= :now', { now: new Date() })
      .getMany();

    let processed = 0;
    let errors = 0;

    for (const product of expiredProducts) {
      try {
        await this.closeIfExpired(product.id);
        processed++;
      } catch (err: unknown) {
        errors++;
        this.logger.error(
          `closeAllExpiredAuctions: failed for product ${product.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return { processed, errors };
  }

  async expireAllOverduePaymentWindows(): Promise<{
    processed: number;
    errors: number;
  }> {
    const overdueProducts = await this.dataSource
      .getRepository(Product)
      .createQueryBuilder('product')
      .innerJoin(
        Bid,
        'bid',
        'bid.productId = product.id AND bid.isCurrentlyPaymentResponsible = :responsible AND bid.paymentDeadline <= :now',
        { responsible: true, now: new Date() },
      )
      .where('product.status = :status', {
        status: ProductStatus.AWAITING_PAYMENT,
      })
      .getMany();

    let processed = 0;
    let errors = 0;

    for (const product of overdueProducts) {
      try {
        await this.handlePaymentExpiry(product.id);
        processed++;
      } catch (err: unknown) {
        errors++;
        this.logger.error(
          `expireAllOverduePaymentWindows: failed for product ${product.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    return { processed, errors };
  }

  /**
   * Finds all pending-payment bids whose deadline falls within the next
   * 1.5–2.5 hours and sends a warning email. Called by the hourly cron.
   *
   * The 1-hour window ensures each bid receives exactly one warning regardless
   * of when its payment window opened relative to the cron schedule.
   * paymentWarningSentAt is only marked on confirmed dispatch so the next
   * cron run can retry on email failure.
   */
  async sendPaymentWarnings(): Promise<{ sent: number; errors: number }> {
    const now = new Date();
    const lowerBound = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const upperBound = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    const pendingBids = await this.dataSource
      .getRepository(Bid)
      .createQueryBuilder('bid')
      .leftJoinAndSelect('bid.bidder', 'bidder')
      .innerJoinAndSelect('bid.product', 'product')
      .where('bid.paymentStatus = :status', {
        status: BidPaymentStatus.PENDING,
      })
      .andWhere('bid.isCurrentlyPaymentResponsible = :responsible', {
        responsible: true,
      })
      .andWhere('bid.paymentDeadline >= :lowerBound', { lowerBound })
      .andWhere('bid.paymentDeadline <= :upperBound', { upperBound })
      .andWhere('bid.paymentWarningSentAt IS NULL')
      .getMany();

    let sent = 0;
    let errors = 0;

    for (const bid of pendingBids) {
      if (!bid.bidder || !bid.product || !bid.paymentDeadline) continue;

      const wasSent = await this.mailService.sendPaymentWindowExpiring(
        bid.bidder.email,
        {
          bidderName: bid.bidder.name,
          productTitle: bid.product.title,
          amount: Number(bid.amount),
          paymentDeadline: bid.paymentDeadline,
          productId: bid.productId,
        },
      );

      if (wasSent) {
        bid.paymentWarningSentAt = new Date();
        try {
          await this.dataSource.getRepository(Bid).save(bid);
          sent++;
        } catch (saveErr: unknown) {
          errors++;
          this.logger.error(
            `sendPaymentWarnings: failed to persist paymentWarningSentAt for bid ${bid.id}`,
            saveErr instanceof Error ? saveErr.stack : String(saveErr),
          );
        }
      } else {
        errors++;
      }
    }

    return { sent, errors };
  }
}
