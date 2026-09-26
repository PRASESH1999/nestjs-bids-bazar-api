import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In, IsNull, QueryRunner } from 'typeorm';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { SellerTier } from '@common/enums/seller-tier.enum';
import { PointsTransactionType } from '@common/enums/points-transaction-type.enum';
import { EventNames } from '@common/events/event-names';
import type { SellerMarkedPaidPayload } from '@common/events/event-payloads.type';
import { ProductPayment } from '@modules/payments/entities/product-payment.entity';
import { Product } from '@modules/products/entities/product.entity';
import { ProductDelivery } from '@modules/pathao/entities/product-delivery.entity';
import { UserRewards } from './entities/user-rewards.entity';
import { PointsTransaction } from './entities/points-transaction.entity';

// Cumulative seller-points thresholds → seller's share of profit (%).
// Ordered ascending; the applicable band is the last one whose `min` the
// seller's CURRENT (pre-this-sale) points meet or exceed. See Rule 16.
const COMMISSION_BANDS: Array<{
  min: number;
  tier: SellerTier;
  commissionPercent: number;
}> = [
  { min: 0, tier: SellerTier.BRONZE, commissionPercent: 20 },
  { min: 500, tier: SellerTier.BRONZE, commissionPercent: 25 },
  { min: 1000, tier: SellerTier.BRONZE, commissionPercent: 30 },
  { min: 1500, tier: SellerTier.SILVER, commissionPercent: 35 },
  { min: 2000, tier: SellerTier.SILVER, commissionPercent: 40 },
  { min: 2500, tier: SellerTier.SILVER, commissionPercent: 45 },
  { min: 3000, tier: SellerTier.GOLD, commissionPercent: 50 },
  { min: 4000, tier: SellerTier.GOLD, commissionPercent: 55 },
  { min: 5000, tier: SellerTier.GOLD, commissionPercent: 60 },
  { min: 6500, tier: SellerTier.PLATINUM, commissionPercent: 65 },
  { min: 8000, tier: SellerTier.PLATINUM, commissionPercent: 70 },
  { min: 10000, tier: SellerTier.PLATINUM, commissionPercent: 75 },
  { min: 12500, tier: SellerTier.DIAMOND, commissionPercent: 80 },
  { min: 15000, tier: SellerTier.DIAMOND, commissionPercent: 90 },
  { min: 20000, tier: SellerTier.DIAMOND, commissionPercent: 100 },
];

export interface CommissionResult {
  profit: number;
  tier: SellerTier;
  commissionPercent: number;
  sellerPayoutAmount: number;
}

@Injectable()
export class RewardsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Resolves tier + commission % from a CUMULATIVE seller-points balance.
  // Pure function — does not read/write the database.
  resolveTierAndCommission(sellerPoints: number): {
    tier: SellerTier;
    commissionPercent: number;
  } {
    let band = COMMISSION_BANDS[0];
    for (const candidate of COMMISSION_BANDS) {
      if (sellerPoints >= candidate.min) band = candidate;
      else break;
    }
    return { tier: band.tier, commissionPercent: band.commissionPercent };
  }

  // Read-only: prices a sale off the seller's CURRENT (pre-this-sale) tier —
  // this sale's own points only affect the NEXT sale (see Rule 16).
  calculateCommission(
    product: Product,
    payment: ProductPayment,
    sellerPoints: number,
  ): CommissionResult {
    const basePrice = Number(product.basePrice);
    const soldPrice = Number(payment.amount);
    const profit = soldPrice - basePrice;
    const { tier, commissionPercent } =
      this.resolveTierAndCommission(sellerPoints);
    const sellerPayoutAmount =
      Math.round((basePrice + (commissionPercent / 100) * profit) * 100) / 100;

    return { profit, tier, commissionPercent, sellerPayoutAmount };
  }

  /**
   * The sole points/commission trigger. Called by an admin once they've
   * paid the seller offline (per the reference sellerPayoutAmount computed
   * here) — NOT automatically on gateway payment success.
   */
  async markSellerPaid(
    paymentId: string,
    adminId: string,
  ): Promise<ProductPayment> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let payload: SellerMarkedPaidPayload | null = null;
    let savedPayment: ProductPayment;

    try {
      const payment = await qr.manager.getRepository(ProductPayment).findOne({
        where: { id: paymentId },
      });
      if (!payment) throw new NotFoundException('ProductPayment not found');
      if (payment.status !== PaymentStatus.SUCCESS) {
        throw new BadRequestException(
          'ProductPayment has not succeeded — cannot settle seller payout yet',
        );
      }
      if (payment.sellerPaidAt) {
        throw new ConflictException(
          'This sale has already been marked paid to the seller',
        );
      }

      const product = await qr.manager.getRepository(Product).findOne({
        where: { id: payment.productId },
      });
      if (!product) {
        throw new InternalServerErrorException(
          'Product not found for payment — data inconsistency',
        );
      }

      const buyerId = payment.winnerUserId;
      const sellerId = product.ownerId;

      // Lock both UserRewards rows in a consistent order (by userId) to
      // avoid a deadlock against a concurrent markSellerPaid where this
      // sale's buyer/seller pair is reversed on another product.
      const [firstId, secondId] = [buyerId, sellerId].sort();
      const firstRewards = await this.lockOrCreateRewards(qr, firstId);
      const secondRewards =
        firstId === secondId
          ? firstRewards
          : await this.lockOrCreateRewards(qr, secondId);

      const buyerRewards = firstId === buyerId ? firstRewards : secondRewards;
      const sellerRewards = firstId === sellerId ? firstRewards : secondRewards;

      const commission = this.calculateCommission(
        product,
        payment,
        sellerRewards.sellerPoints,
      );

      const pointsEarned = Math.round(0.01 * Number(payment.amount));

      buyerRewards.buyerPoints += pointsEarned;
      sellerRewards.sellerPoints += pointsEarned;
      sellerRewards.sellerTier = this.resolveTierAndCommission(
        sellerRewards.sellerPoints,
      ).tier;

      // buyerId === sellerId should never happen (an owner can't bid on
      // their own product — Rule 14), but saving twice in that case is a
      // harmless no-op rather than a bug worth guarding against here.
      await qr.manager.getRepository(UserRewards).save(buyerRewards);
      await qr.manager.getRepository(UserRewards).save(sellerRewards);

      await qr.manager.getRepository(PointsTransaction).save(
        qr.manager.getRepository(PointsTransaction).create([
          {
            userId: buyerId,
            type: PointsTransactionType.BUYER,
            delta: pointsEarned,
            reason: `1% of settled sale amount (payment ${payment.id})`,
            referenceId: payment.id,
          },
          {
            userId: sellerId,
            type: PointsTransactionType.SELLER,
            delta: pointsEarned,
            reason: `1% of settled sale amount (payment ${payment.id})`,
            referenceId: payment.id,
          },
        ]),
      );

      payment.sellerPaidAt = new Date();
      payment.sellerPaidById = adminId;
      payment.sellerPayoutAmount = commission.sellerPayoutAmount;
      payment.sellerCommissionPercent = commission.commissionPercent;

      savedPayment = await qr.manager
        .getRepository(ProductPayment)
        .save(payment);

      await qr.commitTransaction();

      payload = {
        paymentId: payment.id,
        productId: payment.productId,
        sellerId,
        buyerId,
        pointsEarned,
        sellerPayoutAmount: commission.sellerPayoutAmount,
      };
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    if (payload) {
      this.eventEmitter.emit(EventNames.SELLER_MARKED_PAID, payload);
    }

    return savedPayment;
  }

  /**
   * Manual admin credit/debit — logged to the same ledger as automatic
   * awards, but with referenceId = null. Recalculates sellerTier only for
   * SELLER-type adjustments; buyer-point adjustments never touch tier.
   */
  async adjustPoints(
    userId: string,
    type: PointsTransactionType,
    delta: number,
    reason: string,
  ): Promise<UserRewards> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const rewards = await this.lockOrCreateRewards(qr, userId);

      if (type === PointsTransactionType.BUYER) {
        rewards.buyerPoints += delta;
      } else {
        rewards.sellerPoints += delta;
        rewards.sellerTier = this.resolveTierAndCommission(
          rewards.sellerPoints,
        ).tier;
      }

      const saved = await qr.manager.getRepository(UserRewards).save(rewards);

      await qr.manager.getRepository(PointsTransaction).save(
        qr.manager.getRepository(PointsTransaction).create({
          userId,
          type,
          delta,
          reason,
          referenceId: null,
        }),
      );

      await qr.commitTransaction();
      return saved;
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  async getOwnRewards(userId: string): Promise<UserRewards | null> {
    return this.dataSource
      .getRepository(UserRewards)
      .findOne({ where: { userId } });
  }

  /**
   * Paid sales whose seller has not been paid out yet, oldest first.
   *
   * Returned as a view rather than raw ProductPayment rows, for three reasons:
   *  - `sellerPayoutAmount`/`sellerCommissionPercent` are only *stored* by
   *    markSellerPaid, so on a raw pending row they were always null — the
   *    admin was asked to transfer money without being told how much. Here
   *    they are computed with the same `calculateCommission` markSellerPaid
   *    will use, off the seller's current tier (a read-only preview; the
   *    stored figure can differ only if another of this seller's sales is
   *    marked paid first and moves their tier).
   *  - The rows carried no product title or seller, so the list could only
   *    print ids.
   *  - The raw row also carried gateway internals (QR payloads, websocket URL).
   *
   * `deliveryStage` is included so a payout can wait until the item has
   * actually reached the warehouse.
   */
  async listPendingSettlements(): Promise<PendingSettlementView[]> {
    const payments = await this.dataSource.getRepository(ProductPayment).find({
      where: { status: PaymentStatus.SUCCESS, sellerPaidAt: IsNull() },
      relations: { product: true, seller: true, winner: true },
      order: { createdAt: 'ASC' },
    });
    if (payments.length === 0) return [];

    const sellerIds = [...new Set(payments.map((p) => p.sellerId))];
    const [rewards, deliveries] = await Promise.all([
      this.dataSource
        .getRepository(UserRewards)
        .find({ where: { userId: In(sellerIds) } }),
      this.dataSource
        .getRepository(ProductDelivery)
        .find({ where: { productPaymentId: In(payments.map((p) => p.id)) } }),
    ]);
    const pointsBySeller = new Map(
      rewards.map((r) => [r.userId, r.sellerPoints]),
    );
    const deliveryByPayment = new Map(
      deliveries.map((d) => [d.productPaymentId, d]),
    );

    return payments.map((p) => {
      const commission = this.calculateCommission(
        p.product,
        p,
        pointsBySeller.get(p.sellerId) ?? 0,
      );
      const delivery = deliveryByPayment.get(p.id);
      return {
        id: p.id,
        productId: p.productId,
        product: { id: p.product.id, title: p.product.title },
        sellerId: p.sellerId,
        seller: p.seller
          ? {
              id: p.seller.id,
              username: p.seller.username,
              email: p.seller.email,
            }
          : null,
        winnerUserId: p.winnerUserId,
        buyer: p.winner
          ? {
              id: p.winner.id,
              username: p.winner.username,
              email: p.winner.email,
            }
          : null,
        referenceLabel: p.referenceLabel,
        status: p.status,
        amount: Number(p.amount),
        deliveryCharge: Number(p.deliveryCharge),
        basePrice: Number(p.product.basePrice),
        sellerTier: commission.tier,
        sellerCommissionPercent: commission.commissionPercent,
        sellerPayoutAmount: commission.sellerPayoutAmount,
        sellerPaidAt: null,
        deliveryStage: delivery
          ? delivery.deliveredAt
            ? 'DELIVERED'
            : delivery.consignmentId
              ? 'IN_TRANSIT'
              : delivery.receivedAtWarehouseAt
                ? 'AT_WAREHOUSE'
                : 'AWAITING_WAREHOUSE'
          : null,
        createdAt: p.createdAt.toISOString(),
      };
    });
  }

  // Locks (or creates, if this is the user's first-ever reward event) the
  // UserRewards row for userId, inside the given transaction.
  private async lockOrCreateRewards(
    qr: QueryRunner,
    userId: string,
  ): Promise<UserRewards> {
    const existing = await qr.manager
      .getRepository(UserRewards)
      .createQueryBuilder('r')
      .setLock('pessimistic_write')
      .where('r.userId = :userId', { userId })
      .getOne();
    if (existing) return existing;

    const created = qr.manager.getRepository(UserRewards).create({
      userId,
      buyerPoints: 0,
      sellerPoints: 0,
      sellerTier: SellerTier.BRONZE,
    });
    return qr.manager.getRepository(UserRewards).save(created);
  }
}

type UserRef = { id: string; username: string; email: string };

export interface PendingSettlementView {
  id: string;
  productId: string;
  product: { id: string; title: string | null };
  sellerId: string;
  seller: UserRef | null;
  winnerUserId: string;
  buyer: UserRef | null;
  referenceLabel: string;
  status: PaymentStatus;
  /** Item price the buyer paid (delivery excluded — it never reaches the seller). */
  amount: number;
  deliveryCharge: number;
  basePrice: number;
  /** Preview, computed as markSellerPaid will — see listPendingSettlements. */
  sellerTier: SellerTier;
  sellerCommissionPercent: number;
  sellerPayoutAmount: number;
  sellerPaidAt: null;
  deliveryStage:
    | 'AWAITING_WAREHOUSE'
    | 'AT_WAREHOUSE'
    | 'IN_TRANSIT'
    | 'DELIVERED'
    | null;
  createdAt: string;
}
