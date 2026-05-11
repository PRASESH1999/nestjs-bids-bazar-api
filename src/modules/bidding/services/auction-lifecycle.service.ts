import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';
import { PaymentConfirmationMethod } from '@common/enums/payment-confirmation-method.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { MailService } from '@modules/mail/mail.service';
import { Bid } from '../entities/bid.entity';

@Injectable()
export class AuctionLifecycleService {
  private readonly logger = new Logger(AuctionLifecycleService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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

    // Captured inside transaction — used for post-commit emails
    let winnerId: string | null = null;
    let sellerId: string | null = null;
    let winningAmount: number | null = null;
    let paymentDeadline: Date | null = null;
    let capturedProductTitle: string | null = null;
    let capturedProductId: string | null = null;
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

    // Captured for post-commit emails
    let outcome: 'fallback' | 'abandoned' | 'noop' = 'noop';
    let newWinnerId: string | null = null;
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
      responsibleBid.paymentStatus = BidPaymentStatus.EXPIRED;
      responsibleBid.isCurrentlyPaymentResponsible = false;

      const nextBid = await qr.manager
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
  }

  // ─── Admin-initiated payment confirmation ─────────────────────────────────

  async confirmPaymentManual(
    adminId: string,
    productId: string,
  ): Promise<Product> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let sellerId: string | null = null;
    let buyerId: string | null = null;
    let confirmedAmount: number | null = null;
    let capturedProductTitle: string | null = null;
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

      await qr.commitTransaction();

      // Capture for post-commit emails
      sellerId = product.ownerId;
      buyerId = responsibleBid.bidderId;
      confirmedAmount = Number(responsibleBid.amount);
      capturedProductTitle = product.title;
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
