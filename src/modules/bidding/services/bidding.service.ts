import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { PaginatedResult } from '@common/types/paginated-result.type';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { MailService } from '@modules/mail/mail.service';
import { Bid } from '../entities/bid.entity';
import { BidListItemAdminDto } from '../dto/bid-list-item-admin.dto';
import { BidListItemDto } from '../dto/bid-list-item.dto';
import {
  ListBidsAdminQueryDto,
  SortOrder,
} from '../dto/list-bids-admin.query.dto';
import { PlaceBidDto } from '../dto/place-bid.dto';

type BidRange = {
  minAmount: Decimal;
  maxAmount: Decimal | null;
  message: string;
};

@Injectable()
export class BiddingService {
  private readonly logger = new Logger(BiddingService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ─── Place a bid ──────────────────────────────────────────────────────────

  async placeBid(
    userId: string,
    productId: string,
    dto: PlaceBidDto,
  ): Promise<Bid> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    // Captured before transaction mutates product — used for post-commit emails
    let previousHighestBidderId: string | null = null;
    let savedBid: Bid;
    let productOwnerId: string;
    let productTitle: string;
    let productId_: string;
    let biddingEndsAt: Date | null;
    let wasFirstBid: boolean;
    let newBidAmount: number;
    let previousBidAmount: number | null;

    try {
      const product = await qr.manager
        .getRepository(Product)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :id', { id: productId })
        .getOne();

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      if (
        product.status !== ProductStatus.PENDING &&
        product.status !== ProductStatus.ACTIVE
      ) {
        throw new BadRequestException(
          `Bidding is not open for this product (status: ${product.status})`,
        );
      }

      if (product.ownerId === userId) {
        throw new ForbiddenException('You cannot bid on your own product');
      }

      if (
        product.currentHighestBidderId !== null &&
        product.currentHighestBidderId === userId
      ) {
        throw new ForbiddenException(
          'You already hold the highest bid — wait for someone to outbid you before bidding again',
        );
      }

      const range = this.computeValidBidRange(product);
      const bidAmount = new Decimal(String(dto.amount));

      if (range.maxAmount === null) {
        if (bidAmount.lessThan(range.minAmount)) {
          throw new BadRequestException(range.message);
        }
      } else {
        if (
          bidAmount.lessThan(range.minAmount) ||
          bidAmount.greaterThan(range.maxAmount)
        ) {
          throw new BadRequestException(range.message);
        }
      }

      const now = new Date();

      // Capture state needed for post-commit emails before mutating product
      previousHighestBidderId = product.currentHighestBidderId;
      productOwnerId = product.ownerId;
      productTitle = product.title;
      productId_ = product.id;
      previousBidAmount =
        product.currentHighestBid !== null
          ? Number(product.currentHighestBid)
          : null;

      const bid = qr.manager.getRepository(Bid).create({
        productId,
        bidderId: userId,
        amount: dto.amount,
        placedAt: now,
        previousHighestAmount: previousBidAmount,
        wasFirstBid: product.status === ProductStatus.PENDING,
        paymentStatus: BidPaymentStatus.NOT_RESPONSIBLE,
      });

      if (product.status === ProductStatus.PENDING) {
        const biddingDurationHours = this.configService.getOrThrow<number>(
          'BIDDING_DURATION_HOURS',
        );

        product.status = ProductStatus.ACTIVE;
        product.biddingStartedAt = now;
        product.biddingEndsAt = new Date(
          now.getTime() + biddingDurationHours * 60 * 60 * 1000,
        );
      }

      product.currentHighestBid = dto.amount;
      product.currentHighestBidderId = userId;

      savedBid = await qr.manager.getRepository(Bid).save(bid);
      await qr.manager.getRepository(Product).save(product);

      // Capture post-mutation state for emails
      biddingEndsAt = product.biddingEndsAt;
      wasFirstBid = savedBid.wasFirstBid;
      newBidAmount = Number(savedBid.amount);

      await qr.commitTransaction();
    } catch (err: unknown) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Post-commit email notifications — failures are non-fatal
    try {
      if (wasFirstBid) {
        // First bid: notify the seller their auction is now live
        const seller = await this.dataSource
          .getRepository(User)
          .findOne({ where: { id: productOwnerId } });
        if (seller) {
          await this.mailService.sendBidPlacedSeller(seller.email, {
            sellerName: seller.name,
            productTitle,
            bidAmount: newBidAmount,
            biddingEndsAt: biddingEndsAt!,
            productId: productId_,
          });
        }
      } else if (
        previousHighestBidderId !== null &&
        previousHighestBidderId !== userId
      ) {
        // Subsequent bid: notify the previous highest bidder they've been outbid
        const previousBidder = await this.dataSource
          .getRepository(User)
          .findOne({ where: { id: previousHighestBidderId } });
        if (previousBidder) {
          await this.mailService.sendBidOutbid(previousBidder.email, {
            bidderName: previousBidder.name,
            productTitle,
            yourBidAmount: previousBidAmount!,
            newHighestBid: newBidAmount,
            biddingEndsAt: biddingEndsAt!,
            productId: productId_,
          });
        }
      }
    } catch (err: unknown) {
      this.logger.error(
        `placeBid: post-commit email failed for product ${productId_}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return savedBid;
  }

  // ─── Query: bids for a product (authenticated user or admin view) ─────────

  async getBidsForProduct(
    productId: string,
    viewerType: 'authenticated' | 'admin',
  ): Promise<BidListItemDto[] | BidListItemAdminDto[]> {
    const product = await this.dataSource
      .getRepository(Product)
      .findOne({ where: { id: productId } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const bids = await this.dataSource
      .getRepository(Bid)
      .createQueryBuilder('bid')
      .leftJoinAndSelect('bid.bidder', 'bidder')
      .where('bid.productId = :productId', { productId })
      .orderBy('bid.placedAt', 'DESC')
      .getMany();

    if (viewerType === 'admin') {
      return bids.map(
        (bid): BidListItemAdminDto => ({
          id: bid.id,
          amount: Number(bid.amount),
          placedAt: bid.placedAt.toISOString(),
          bidderId: bid.bidderId,
          bidderName: bid.bidder?.name ?? '',
          bidderEmail: bid.bidder?.email ?? '',
          paymentStatus: bid.paymentStatus,
          paymentDeadline: bid.paymentDeadline
            ? bid.paymentDeadline.toISOString()
            : null,
          isOriginalWinner: bid.isOriginalWinner,
          fallbackRank: bid.fallbackRank,
          isCurrentlyPaymentResponsible: bid.isCurrentlyPaymentResponsible,
        }),
      );
    }

    return bids.map(
      (bid): BidListItemDto => ({
        id: bid.id,
        amount: Number(bid.amount),
        placedAt: bid.placedAt.toISOString(),
        bidderName: bid.bidder?.name ?? '',
      }),
    );
  }

  // ─── Query: my bids (authenticated user) ─────────────────────────────────

  async getMyBids(
    userId: string,
    query: PaginationDto,
  ): Promise<PaginatedResult<Bid>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [bids, total] = await this.dataSource
      .getRepository(Bid)
      .createQueryBuilder('bid')
      .leftJoinAndSelect('bid.product', 'product')
      .where('bid.bidderId = :userId', { userId })
      .orderBy('bid.placedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: bids,
      meta: { page, limit, total },
    };
  }

  // ─── Query: all bids (admin) ──────────────────────────────────────────────

  async listAllBids(
    query: ListBidsAdminQueryDto,
  ): Promise<PaginatedResult<Bid>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'placedAt';
    const sortOrder: SortOrder = query.sortOrder ?? SortOrder.DESC;

    const qb = this.dataSource
      .getRepository(Bid)
      .createQueryBuilder('bid')
      .leftJoinAndSelect('bid.bidder', 'bidder')
      .leftJoinAndSelect('bid.product', 'product');

    if (query.productId) {
      qb.andWhere('bid.productId = :productId', { productId: query.productId });
    }
    if (query.bidderId) {
      qb.andWhere('bid.bidderId = :bidderId', { bidderId: query.bidderId });
    }
    if (query.paymentStatus) {
      qb.andWhere('bid.paymentStatus = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }

    qb.orderBy(`bid.${sortBy}`, sortOrder);

    const [bids, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: bids,
      meta: { page, limit, total },
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private computeValidBidRange(product: Product): BidRange {
    if (product.status === ProductStatus.PENDING) {
      const minAmount = new Decimal(String(product.biddingStartPrice));
      return {
        minAmount,
        maxAmount: null,
        message: `First bid must be at least Rs. ${minAmount.toFixed(2)}`,
      };
    }

    const current = new Decimal(String(product.currentHighestBid));
    const percentRaw = this.configService.getOrThrow<number>(
      'BID_INCREMENT_PERCENT',
    );
    const flatRaw = this.configService.getOrThrow<number>(
      'BID_INCREMENT_MIN_FLAT',
    );

    const incrementPercent = new Decimal(String(percentRaw));
    const incrementFlat = new Decimal(String(flatRaw));

    const percentInc = current.mul(incrementPercent).toDecimalPlaces(2);
    const minInc = incrementFlat;
    const maxInc = percentInc;

    let minAmount: Decimal;
    let maxAmount: Decimal;

    if (minInc.greaterThan(maxInc)) {
      minAmount = current.add(incrementFlat).toDecimalPlaces(2);
      maxAmount = minAmount;
    } else {
      minAmount = current.add(minInc).toDecimalPlaces(2);
      maxAmount = current.add(maxInc).toDecimalPlaces(2);
    }

    const message = minAmount.equals(maxAmount)
      ? `Bid must be exactly Rs. ${minAmount.toFixed(2)} (currently leading: Rs. ${current.toFixed(2)})`
      : `Bid must be between Rs. ${minAmount.toFixed(2)} and Rs. ${maxAmount.toFixed(2)} (currently leading: Rs. ${current.toFixed(2)})`;

    return { minAmount, maxAmount, message };
  }
}
