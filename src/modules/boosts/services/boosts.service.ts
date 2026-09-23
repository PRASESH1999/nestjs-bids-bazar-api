import { PaginatedResult } from '@common/types/paginated-result.type';
import { ACTIVE_LISTING_STATUSES } from '@common/enums/product-status.enum';
import { BoostItemStatus } from '@common/enums/boost-item-status.enum';
import { BoostScheme } from '@common/enums/boost-scheme.enum';
import { PaymentStatus } from '@common/enums/payment-status.enum';
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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { In, Repository } from 'typeorm';
import { BOOST_PLANS } from '../boost-plans.config';
import type {
  BoostStatusResponseDto,
  InitiateBoostResponseDto,
} from '../dto/boost.dto';
import type { ListBoostItemsAdminQueryDto } from '../dto/list-boost-items-admin.query.dto';
import type { ListBoostPaymentsAdminQueryDto } from '../dto/list-boost-payments-admin.query.dto';
import { BoostItem } from '../entities/boost-item.entity';
import { BoostPayment } from '../entities/boost-payment.entity';

@Injectable()
export class BoostsService {
  private readonly logger = new Logger(BoostsService.name);

  constructor(
    @InjectRepository(BoostItem)
    private readonly boostItemRepo: Repository<BoostItem>,
    @InjectRepository(BoostPayment)
    private readonly boostPaymentRepo: Repository<BoostPayment>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly fonepayClientService: FonepayClientService,
    private readonly configService: ConfigService,
  ) {}

  getPlans() {
    return Object.values(BOOST_PLANS);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async initiateBoost(
    productId: string,
    requestingUserId: string,
    scheme: BoostScheme,
  ): Promise<InitiateBoostResponseDto> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (product.ownerId !== requestingUserId) {
      throw new ForbiddenException('You do not own this product');
    }

    if (!ACTIVE_LISTING_STATUSES.includes(product.status)) {
      throw new BadRequestException(
        `Product is not currently biddable (status: ${product.status})`,
      );
    }

    // At most one in-flight or currently-running boost per product — mirrors
    // the DB-level partial unique index on BoostItem.
    const existingItem = await this.boostItemRepo.findOne({
      where: {
        productId,
        status: In([BoostItemStatus.PENDING_PAYMENT, BoostItemStatus.ACTIVE]),
      },
    });

    if (existingItem?.status === BoostItemStatus.ACTIVE) {
      throw new ConflictException('This product already has an active boost');
    }

    if (existingItem) {
      const pendingPayment = await this.boostPaymentRepo.findOne({
        where: { boostItemId: existingItem.id, status: PaymentStatus.PENDING },
        order: { createdAt: 'DESC' },
      });

      // Reuse the still-valid in-flight QR rather than creating a duplicate.
      if (
        pendingPayment &&
        pendingPayment.paymentDeadline > new Date() &&
        pendingPayment.qrString
      ) {
        return this.toInitiateResponse(existingItem, pendingPayment);
      }

      // Stale attempt (expired, or never got a QR) — cancel it so a fresh
      // BoostItem can be created below without tripping the unique index.
      await this.boostItemRepo.update(existingItem.id, {
        status: BoostItemStatus.CANCELLED,
      });
      if (pendingPayment) {
        await this.boostPaymentRepo.update(pendingPayment.id, {
          status: PaymentStatus.EXPIRED,
        });
      }
    }

    const plan = BOOST_PLANS[scheme];
    const referenceLabel = await this.generateUniqueReferenceLabel();

    const boostItem = await this.boostItemRepo.save(
      this.boostItemRepo.create({
        productId,
        sellerId: requestingUserId,
        scheme,
        amount: plan.price,
        status: BoostItemStatus.PENDING_PAYMENT,
      }),
    );

    const qrResult = await this.fonepayClientService.generateIntentQr({
      amount: plan.price,
      billId: boostItem.id,
      referenceLabel,
    });

    const deadlineMinutes = this.configService.get<number>(
      'BOOST_PAYMENT_WINDOW_MINUTES',
      15,
    );

    const payment = await this.boostPaymentRepo.save(
      this.boostPaymentRepo.create({
        boostItemId: boostItem.id,
        productId,
        sellerId: requestingUserId,
        amount: plan.price,
        referenceLabel,
        terminalId: qrResult.terminalId,
        qrString: qrResult.qrString,
        qrMessage: qrResult.qrMessage,
        status: PaymentStatus.PENDING,
        paymentDeadline: new Date(Date.now() + deadlineMinutes * 60_000),
      }),
    );

    return this.toInitiateResponse(boostItem, payment);
  }

  async getStatus(
    productId: string,
    requestingUserId: string,
  ): Promise<BoostStatusResponseDto> {
    const boostItem = await this.boostItemRepo.findOne({
      where: { productId, sellerId: requestingUserId },
      order: { createdAt: 'DESC' },
    });
    if (!boostItem) {
      throw new NotFoundException('No boost found for this product');
    }

    const payment = await this.boostPaymentRepo.findOne({
      where: { boostItemId: boostItem.id },
      order: { createdAt: 'DESC' },
    });
    if (!payment) {
      throw new NotFoundException('No boost payment found for this product');
    }

    if (payment.status === PaymentStatus.PENDING) {
      try {
        const fonepayStatus = await this.fonepayClientService.getPaymentStatus({
          referenceLabel: payment.referenceLabel,
        });

        if (fonepayStatus.paymentStatus === 'success') {
          await this.confirmSuccess(payment.id, fonepayStatus);
        } else if (fonepayStatus.paymentStatus === 'failed') {
          await this.markFailed(payment.id, fonepayStatus.paymentMessage);
        }

        const [refreshedItem, refreshedPayment] = await Promise.all([
          this.boostItemRepo.findOne({ where: { id: boostItem.id } }),
          this.boostPaymentRepo.findOne({ where: { id: payment.id } }),
        ]);

        return this.toStatusResponse(
          refreshedItem ?? boostItem,
          refreshedPayment ?? payment,
        );
      } catch (err: unknown) {
        // Fonepay unavailable — return current cached state
        this.logger.warn(
          `getStatus: Fonepay status check failed for boost payment ${payment.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return this.toStatusResponse(boostItem, payment);
  }

  async confirmSuccess(
    paymentId: string,
    statusResult?: FonepayPaymentStatusResponse,
  ): Promise<void> {
    const payment = await this.boostPaymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) return;
    if (payment.status === PaymentStatus.SUCCESS) return; // idempotent

    const boostItem = await this.boostItemRepo.findOne({
      where: { id: payment.boostItemId },
    });
    if (!boostItem) return;

    const plan = BOOST_PLANS[boostItem.scheme];
    const startDateTime = new Date();
    const endDateTime = new Date(
      startDateTime.getTime() + plan.days * 24 * 60 * 60 * 1000,
    );

    await this.boostItemRepo.update(boostItem.id, {
      status: BoostItemStatus.ACTIVE,
      startDateTime,
      endDateTime,
    });

    await this.boostPaymentRepo.update(paymentId, {
      status: PaymentStatus.SUCCESS,
      fonepayTraceId: statusResult?.fonepayTraceId ?? null,
      paymentMessage: statusResult?.paymentMessage ?? null,
    });
  }

  async markFailed(paymentId: string, message: string): Promise<void> {
    const payment = await this.boostPaymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment) return;
    if (payment.status === PaymentStatus.FAILED) return; // idempotent

    await this.boostPaymentRepo.update(paymentId, {
      status: PaymentStatus.FAILED,
      paymentMessage: message,
    });
    await this.boostItemRepo.update(payment.boostItemId, {
      status: BoostItemStatus.CANCELLED,
    });
  }

  // Called by BoostsCron to mark an expired PENDING boost payment.
  async expireBoostPayment(paymentId: string): Promise<void> {
    const payment = await this.boostPaymentRepo.findOne({
      where: { id: paymentId },
    });
    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    await this.boostPaymentRepo.update(paymentId, {
      status: PaymentStatus.EXPIRED,
    });
    await this.boostItemRepo.update(payment.boostItemId, {
      status: BoostItemStatus.CANCELLED,
    });
    this.logger.log(
      `expireBoostPayment: boost payment ${paymentId} marked EXPIRED`,
    );
  }

  // Called by BoostsCron: flips ACTIVE boost items whose window has ended to
  // EXPIRED, freeing the product up for a new purchase. Returns the count
  // affected.
  async expireEndedBoosts(): Promise<number> {
    const result = await this.boostItemRepo
      .createQueryBuilder()
      .update(BoostItem)
      .set({ status: BoostItemStatus.EXPIRED })
      .where('status = :status', { status: BoostItemStatus.ACTIVE })
      .andWhere('"endDateTime" <= :now', { now: new Date() })
      .execute();

    return result.affected ?? 0;
  }

  // ─── Featured section ──────────────────────────────────────────────────────

  // Paginated product ids of boosted products still within their (ACTIVE)
  // boost window AND still biddable — a product drops out the moment either
  // its boost or its auction ends, whichever comes first. Latest boost
  // first. Consumed by ProductsService.getFeaturedProducts (GET
  // /products/home/featured) so the featured section renders through the
  // same home-page product-card pipeline (images, favorited state, seller
  // summary, bid count) as trending/new/rare.
  async getFeaturedProductIds(
    page: number,
    limit: number,
  ): Promise<{ ids: string[]; total: number }> {
    const baseQb = () =>
      this.boostItemRepo
        .createQueryBuilder('boostItem')
        .innerJoin(Product, 'product', 'product.id = boostItem.productId')
        .where('boostItem.status = :status', {
          status: BoostItemStatus.ACTIVE,
        })
        .andWhere('product.status IN (:...statuses)', {
          statuses: ACTIVE_LISTING_STATUSES,
        });

    const total = await baseQb().getCount();

    const rows = await baseQb()
      .select('boostItem.productId', 'productId')
      .orderBy('boostItem.startDateTime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany<{ productId: string }>();

    return { ids: rows.map((row) => row.productId), total };
  }

  /**
   * When each of these products' running boost ends, for the ones that have one.
   *
   * One query for a whole page of products — the same batching FavoritesService
   * uses for `isFavorited` — so a list response never costs a lookup per row.
   * A product absent from the map is not boosted.
   *
   * "Running" means ACTIVE *and* not yet past its end. The cron that flips an
   * elapsed boost to EXPIRED runs on an interval, so between its ticks an
   * ACTIVE row can already be over; checking the end time here keeps a card
   * from advertising a boost that has run out.
   */
  async boostedUntilFor(productIds: string[]): Promise<Map<string, Date>> {
    if (productIds.length === 0) return new Map();

    const rows = await this.boostItemRepo
      .createQueryBuilder('boostItem')
      .select(['boostItem.productId', 'boostItem.endDateTime'])
      .where('boostItem.productId IN (:...productIds)', { productIds })
      .andWhere('boostItem.status = :status', {
        status: BoostItemStatus.ACTIVE,
      })
      .andWhere('boostItem.endDateTime > now()')
      .getMany();

    return new Map(
      rows
        .filter(
          (row): row is BoostItem & { endDateTime: Date } =>
            row.endDateTime !== null,
        )
        .map((row) => [row.productId, row.endDateTime]),
    );
  }

  // ─── Admin: boost records ──────────────────────────────────────────────────

  async listAllBoostItems(
    query: ListBoostItemsAdminQueryDto,
  ): Promise<PaginatedResult<BoostItem>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.boostItemRepo
      .createQueryBuilder('boostItem')
      .leftJoinAndSelect('boostItem.seller', 'seller')
      .leftJoinAndSelect('boostItem.product', 'product');

    if (query.productId) {
      qb.andWhere('boostItem.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.sellerId) {
      qb.andWhere('boostItem.sellerId = :sellerId', {
        sellerId: query.sellerId,
      });
    }
    if (query.status) {
      qb.andWhere('boostItem.status = :status', { status: query.status });
    }

    qb.orderBy(`boostItem.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total } };
  }

  async listAllBoostPayments(
    query: ListBoostPaymentsAdminQueryDto,
  ): Promise<PaginatedResult<BoostPayment>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.boostPaymentRepo
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.seller', 'seller')
      .leftJoinAndSelect('payment.product', 'product');

    if (query.productId) {
      qb.andWhere('payment.productId = :productId', {
        productId: query.productId,
      });
    }
    if (query.sellerId) {
      qb.andWhere('payment.sellerId = :sellerId', {
        sellerId: query.sellerId,
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

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async generateUniqueReferenceLabel(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = crypto.randomBytes(22);
      let label = '';
      for (let i = 0; i < 22; i++) {
        label += chars[bytes[i] % chars.length];
      }
      const exists = await this.boostPaymentRepo.findOne({
        where: { referenceLabel: label },
      });
      if (!exists) return label;
    }
    throw new Error(
      'Failed to generate a unique referenceLabel after 5 attempts',
    );
  }

  private toInitiateResponse(
    item: BoostItem,
    payment: BoostPayment,
  ): InitiateBoostResponseDto {
    return {
      boostItemId: item.id,
      paymentId: payment.id,
      referenceLabel: payment.referenceLabel,
      scheme: item.scheme,
      amount: Number(payment.amount),
      qrString: payment.qrString ?? '',
      qrMessage: payment.qrMessage ?? '',
      status: payment.status,
      paymentDeadline: payment.paymentDeadline.toISOString(),
    };
  }

  private toStatusResponse(
    item: BoostItem,
    payment: BoostPayment,
  ): BoostStatusResponseDto {
    return {
      boostItemId: item.id,
      paymentId: payment.id,
      scheme: item.scheme,
      boostStatus: item.status,
      amount: Number(payment.amount),
      paymentStatus: payment.status,
      startDateTime: item.startDateTime
        ? item.startDateTime.toISOString()
        : null,
      endDateTime: item.endDateTime ? item.endDateTime.toISOString() : null,
      fonepayTraceId: payment.fonepayTraceId,
      paymentMessage: payment.paymentMessage,
    };
  }
}
