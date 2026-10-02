import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { IsNull, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { EventNames } from '@common/events/event-names';
import { NotificationType } from '@common/enums/notification-type.enum';
import type { PaymentSucceededPayload } from '@common/events/event-payloads.type';
import { ShippingAddress } from '@modules/shipping/entities/shipping-address.entity';
import { ProductPayment } from '@modules/payments/entities/product-payment.entity';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { MailService } from '@modules/mail/mail.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { ProductDelivery } from '../entities/product-delivery.entity';
import { PathaoClientService } from './pathao-client.service';
import type { DispatchDeliveryDto } from '../dto/pathao.dto';
import { classifyPathaoStatus, deliveryStageOf } from '../delivery-stage.util';
import {
  DeliveryStage,
  type AdminDeliveryListDto,
  type AdminDeliveryView,
  type BuyerDeliveryView,
  type DeliveryQuoteDto,
  type ListDeliveriesQueryDto,
} from '../dto/delivery-view.dto';

// Pathao status matching (DELIVERED_STATUS_MARKERS / CANCELLED_STATUS_MARKER,
// both unverified — A43) lives in ../delivery-stage.util with the stage logic.

// A buyer/admin read re-syncs a dispatched delivery from Pathao, but no more
// often than this — repeated polling of the payment-status endpoint must not
// turn into a Pathao API call each time.
const READ_SYNC_MIN_INTERVAL_MS = 60_000;

@Injectable()
export class ProductDeliveriesService {
  private readonly logger = new Logger(ProductDeliveriesService.name);

  constructor(
    @InjectRepository(ProductDelivery)
    private readonly deliveryRepo: Repository<ProductDelivery>,
    @InjectRepository(ShippingAddress)
    private readonly addressRepo: Repository<ShippingAddress>,
    @InjectRepository(ProductPayment)
    private readonly paymentRepo: Repository<ProductPayment>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly pathaoClientService: PathaoClientService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  // ─── Creation (event-driven, exactly once per successful sale) ────────────

  @OnEvent(EventNames.PAYMENT_SUCCEEDED, { async: true })
  async onPaymentSucceeded(payload: PaymentSucceededPayload): Promise<void> {
    try {
      const existing = await this.deliveryRepo.findOne({
        where: { productPaymentId: payload.paymentId },
      });
      if (existing) return; // idempotent — already created

      if (!payload.shippingAddressId) {
        this.logger.error(
          `onPaymentSucceeded: payment ${payload.paymentId} succeeded with no shippingAddressId — cannot create a delivery record`,
        );
        return;
      }

      const address = await this.addressRepo.findOne({
        where: { id: payload.shippingAddressId },
      });
      if (!address) {
        this.logger.error(
          `onPaymentSucceeded: shipping address ${payload.shippingAddressId} not found for payment ${payload.paymentId}`,
        );
        return;
      }
      if (!address.pathaoCityId || !address.pathaoZoneId) {
        this.logger.error(
          `onPaymentSucceeded: shipping address ${address.id} has no Pathao city/zone — cannot create a delivery record for payment ${payload.paymentId}`,
        );
        return;
      }

      const delivery = this.deliveryRepo.create({
        productPaymentId: payload.paymentId,
        recipientName: address.recipientName,
        recipientPhone: address.recipientPhone,
        province: address.province,
        district: address.district,
        city: address.city,
        street: address.street,
        wardNumber: address.wardNumber,
        landmark: address.landmark,
        pathaoCityId: address.pathaoCityId,
        pathaoCityName: address.pathaoCityName,
        pathaoZoneId: address.pathaoZoneId,
        pathaoZoneName: address.pathaoZoneName,
        pathaoAreaId: address.pathaoAreaId,
        pathaoAreaName: address.pathaoAreaName,
        deliveryCharge: payload.deliveryCharge,
      });
      await this.deliveryRepo.save(delivery);
    } catch (err: unknown) {
      this.logger.error(
        `onPaymentSucceeded: failed to create delivery record for payment ${payload.paymentId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ─── Lookups ────────────────────────────────────────────────────────────

  async findByPaymentId(
    productPaymentId: string,
  ): Promise<ProductDelivery | null> {
    return this.deliveryRepo.findOne({ where: { productPaymentId } });
  }

  async getOne(id: string): Promise<AdminDeliveryView> {
    const delivery = await this.findOneOrThrow(id);
    await this.syncOnRead(delivery);
    return this.toAdminViewById(id);
  }

  /** The buyer's view of the parcel for a payment, or null before it exists. */
  async findBuyerViewByPaymentId(
    productPaymentId: string,
  ): Promise<BuyerDeliveryView | null> {
    const delivery = await this.findByPaymentId(productPaymentId);
    if (!delivery) return null;
    return this.toBuyerView(await this.syncOnRead(delivery));
  }

  quote(): DeliveryQuoteDto {
    return {
      deliveryCharge: Number(
        this.configService.getOrThrow<number>('DELIVERY_CHARGE_FLAT'),
      ),
      currency: 'NPR',
      serviceableCityIds: this.pathaoClientService.serviceableCityIds(),
    };
  }

  private async findOneOrThrow(id: string): Promise<ProductDelivery> {
    const delivery = await this.deliveryRepo.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  // ─── Admin: lifecycle actions ──────────────────────────────────────────

  async markReceivedAtWarehouse(
    id: string,
    adminId: string,
  ): Promise<AdminDeliveryView> {
    const delivery = await this.findOneOrThrow(id);
    if (!delivery.receivedAtWarehouseAt) {
      delivery.receivedAtWarehouseAt = new Date();
      delivery.receivedAtWarehouseById = adminId;
      await this.deliveryRepo.save(delivery);
    }
    return this.toAdminViewById(id);
  }

  async dispatch(
    id: string,
    adminId: string,
    dto: DispatchDeliveryDto,
  ): Promise<AdminDeliveryView> {
    const delivery = await this.findOneOrThrow(id);

    // Idempotent — already dispatched.
    if (delivery.consignmentId) return this.toAdminViewById(id);

    if (!delivery.receivedAtWarehouseAt) {
      throw new BadRequestException(
        'This item has not been marked received at the warehouse yet',
      );
    }

    if (!this.pathaoClientService.isServiceable(delivery.pathaoCityId)) {
      throw new BadRequestException(
        'This delivery address is outside the area we can currently fulfil (Kathmandu Valley only)',
      );
    }

    await this.createPathaoOrder(delivery, adminId, dto, delivery.id);
    return this.toAdminViewById(id);
  }

  /**
   * Replaces a cancelled Pathao order with a fresh one for the same parcel.
   * The status is re-synced first so a stale local view can't redispatch a
   * delivery that is in fact still live at Pathao.
   */
  async redispatch(
    id: string,
    adminId: string,
    dto: DispatchDeliveryDto,
  ): Promise<AdminDeliveryView> {
    const delivery = await this.findOneOrThrow(id);
    if (delivery.consignmentId && !delivery.cancelledAt) {
      await this.refreshStatus(delivery);
    }

    if (!delivery.cancelledAt || !delivery.consignmentId) {
      throw new BadRequestException(
        'Only a delivery whose Pathao order was cancelled can be redispatched',
      );
    }

    const attempt = delivery.previousConsignmentIds.length + 1;

    // merchantOrderId must differ from the cancelled order's, or Pathao may
    // reject it as a duplicate — the first dispatch used the bare delivery id.
    await this.createPathaoOrder(
      delivery,
      adminId,
      dto,
      `${delivery.id}-r${attempt}`,
      delivery.consignmentId,
    );
    return this.toAdminViewById(id);
  }

  private async createPathaoOrder(
    delivery: ProductDelivery,
    adminId: string,
    dto: DispatchDeliveryDto,
    merchantOrderId: string,
    supersedes?: string,
  ): Promise<void> {
    const storeId = this.configService.getOrThrow<number>('PATHAO_STORE_ID');

    const itemDescription =
      dto.itemDescription ?? (await this.resolveProductTitle(delivery));

    const result = await this.pathaoClientService.createOrder({
      storeId,
      merchantOrderId,
      recipientName: delivery.recipientName,
      recipientPhone: delivery.recipientPhone,
      recipientAddress: this.composeAddressText(delivery),
      recipientCity: delivery.pathaoCityId,
      recipientZone: delivery.pathaoZoneId,
      recipientArea: delivery.pathaoAreaId,
      itemQuantity: 1,
      itemWeightKg: dto.itemWeightKg,
      itemDescription,
      amountToCollect: 0,
    });

    if (supersedes) {
      delivery.previousConsignmentIds = [
        ...delivery.previousConsignmentIds,
        supersedes,
      ];
      // Index-aligned with previousConsignmentIds — the fee below is about to
      // be overwritten with the new order's (A57).
      delivery.previousPathaoDeliveryFees = [
        ...(delivery.previousPathaoDeliveryFees ?? []),
        delivery.pathaoDeliveryFee,
      ];
      delivery.cancelledAt = null;
    }

    delivery.storeId = storeId;
    delivery.consignmentId = result.consignmentId;
    delivery.pathaoDeliveryFee = result.deliveryFee;
    delivery.orderStatus = result.orderStatus;
    delivery.lastStatusCheckAt = null;
    delivery.itemWeightKg = dto.itemWeightKg;
    delivery.itemDescription = itemDescription;
    delivery.dispatchedAt = new Date();
    delivery.dispatchedById = adminId;

    await this.deliveryRepo.save(delivery);
  }

  async syncStatus(id: string): Promise<AdminDeliveryView> {
    const delivery = await this.findOneOrThrow(id);
    if (!delivery.consignmentId) {
      throw new BadRequestException(
        'This delivery has not been dispatched yet',
      );
    }
    await this.refreshStatus(delivery);
    return this.toAdminViewById(id);
  }

  /** Shared by syncStatus (manual) and the cron sweep (automatic). */
  async refreshStatus(delivery: ProductDelivery): Promise<ProductDelivery> {
    if (!delivery.consignmentId) return delivery;
    const info = await this.pathaoClientService.getOrderInfo(
      delivery.consignmentId,
    );

    delivery.orderStatus = info.orderStatusSlug || info.orderStatus;
    delivery.lastStatusCheckAt = new Date();

    const { isDelivered, isCancelled } = classifyPathaoStatus(
      delivery.orderStatus,
    );
    let newlyCancelled = false;

    if (isDelivered && !delivery.deliveredAt) {
      delivery.deliveredAt = new Date();
    } else if (isCancelled && !delivery.cancelledAt) {
      delivery.cancelledAt = new Date();
      newlyCancelled = true;
      this.logger.warn(
        `refreshStatus: delivery ${delivery.id} (consignment ${delivery.consignmentId}) was cancelled at Pathao ("${delivery.orderStatus}")`,
      );
    } else if (!isDelivered && !isCancelled) {
      this.logger.debug(
        `refreshStatus: delivery ${delivery.id} status is "${delivery.orderStatus}" (not recognized as terminal)`,
      );
    }

    const saved = await this.deliveryRepo.save(delivery);
    // After the save, so the cancellation is on record before anyone is told.
    if (newlyCancelled) await this.notifyCancelled(saved);
    return saved;
  }

  /**
   * A cancelled courier order used to be silent (A57) — it only surfaced if an
   * admin happened to open the CANCELLED tab. Tells the buyer (in-app) that we
   * are rebooking it, and the support mailbox that someone has to. Best-effort:
   * a failed notification is logged and never undoes the status change.
   */
  private async notifyCancelled(delivery: ProductDelivery): Promise<void> {
    try {
      const payment = await this.paymentRepo.findOne({
        where: { id: delivery.productPaymentId },
      });
      if (!payment) return;
      const [product, buyer] = await Promise.all([
        this.productRepo.findOne({ where: { id: payment.productId } }),
        this.userRepo.findOne({ where: { id: payment.winnerUserId } }),
      ]);
      const productTitle = product?.title ?? 'your item';

      await this.notificationsService.createForUser({
        userId: payment.winnerUserId,
        type: NotificationType.DELIVERY_CANCELLED,
        // productId per the other buyer notifications. The (userId, type,
        // relatedId) unique index means a second cancellation of the same
        // parcel after a redispatch does not notify the buyer again.
        relatedId: payment.productId,
        title: "Your courier order was cancelled — we're rebooking it",
        message: `The courier cancelled the delivery order for "${productTitle}". We're booking a new one — you don't need to do anything.`,
        data: { productId: payment.productId },
      });

      await this.mailService.sendDeliveryCancelledAdmin({
        productTitle,
        deliveryId: delivery.id,
        // Non-null: only a dispatched delivery can be cancelled.
        consignmentId: delivery.consignmentId!,
        orderStatus: delivery.orderStatus ?? '',
        buyerUsername: buyer?.username ?? null,
      });
    } catch (err: unknown) {
      this.logger.error(
        `notifyCancelled: failed to notify about cancelled delivery ${delivery.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Best-effort live sync for a read. A failing or slow Pathao must never take
   * down the page that asked (the payment-status response embeds this), so any
   * error is logged and the last stored state is returned instead.
   */
  private async syncOnRead(
    delivery: ProductDelivery,
  ): Promise<ProductDelivery> {
    if (
      !delivery.consignmentId ||
      delivery.deliveredAt ||
      delivery.cancelledAt
    ) {
      return delivery;
    }
    const lastCheck = delivery.lastStatusCheckAt?.getTime() ?? 0;
    if (Date.now() - lastCheck < READ_SYNC_MIN_INTERVAL_MS) return delivery;

    try {
      return await this.refreshStatus(delivery);
    } catch (err: unknown) {
      this.logger.warn(
        `syncOnRead: could not refresh delivery ${delivery.id} from Pathao, serving stored state (${err instanceof Error ? err.message : String(err)})`,
      );
      return delivery;
    }
  }

  async findDispatchedNotDelivered(): Promise<ProductDelivery[]> {
    return this.deliveryRepo.find({
      where: {
        consignmentId: Not(IsNull()),
        deliveredAt: IsNull(),
        cancelledAt: IsNull(),
      },
    });
  }

  // ─── Admin: listing ─────────────────────────────────────────────────────

  async listAll(query: ListDeliveriesQueryDto): Promise<AdminDeliveryListDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.adminQuery().orderBy('delivery.createdAt', 'DESC');
    if (query.stage) this.whereStage(qb, query.stage);

    const [rows, total, counts] = await Promise.all([
      qb
        .clone()
        .skip((page - 1) * limit)
        .take(limit)
        .getMany(),
      qb.clone().getCount(),
      this.stageCounts(),
    ]);

    return {
      data: rows.map((d) => this.toAdminView(d)),
      meta: { page, limit, total },
      counts,
    };
  }

  private async stageCounts(): Promise<Record<DeliveryStage, number>> {
    const stages = Object.values(DeliveryStage);
    const totals = await Promise.all(
      stages.map((stage) => {
        const qb = this.deliveryRepo.createQueryBuilder('delivery');
        this.whereStage(qb, stage);
        return qb.getCount();
      }),
    );
    return Object.fromEntries(
      stages.map((stage, i) => [stage, totals[i]]),
    ) as Record<DeliveryStage, number>;
  }

  /** The SQL twin of `deliveryStageOf` — keep the two in step. */
  private whereStage(
    qb: SelectQueryBuilder<ProductDelivery>,
    stage: DeliveryStage,
  ): void {
    switch (stage) {
      case DeliveryStage.AWAITING_WAREHOUSE:
        qb.andWhere('delivery.receivedAtWarehouseAt IS NULL');
        break;
      case DeliveryStage.AT_WAREHOUSE:
        qb.andWhere('delivery.receivedAtWarehouseAt IS NOT NULL').andWhere(
          'delivery.consignmentId IS NULL',
        );
        break;
      case DeliveryStage.IN_TRANSIT:
        qb.andWhere('delivery.consignmentId IS NOT NULL')
          .andWhere('delivery.deliveredAt IS NULL')
          .andWhere('delivery.cancelledAt IS NULL');
        break;
      case DeliveryStage.DELIVERED:
        qb.andWhere('delivery.deliveredAt IS NOT NULL');
        break;
      case DeliveryStage.CANCELLED:
        qb.andWhere('delivery.cancelledAt IS NOT NULL').andWhere(
          'delivery.deliveredAt IS NULL',
        );
        break;
    }
  }

  // ─── Views ──────────────────────────────────────────────────────────────

  private adminQuery(): SelectQueryBuilder<ProductDelivery> {
    return this.deliveryRepo
      .createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.productPayment', 'payment')
      .leftJoin('payment.product', 'product')
      .addSelect(['product.id', 'product.title'])
      .leftJoin('payment.winner', 'buyer')
      .addSelect(['buyer.id', 'buyer.username', 'buyer.email']);
  }

  private async toAdminViewById(id: string): Promise<AdminDeliveryView> {
    const delivery = await this.adminQuery()
      .where('delivery.id = :id', { id })
      .getOne();
    if (!delivery) throw new NotFoundException('Delivery not found');
    return this.toAdminView(delivery);
  }

  private toBuyerView(d: ProductDelivery): BuyerDeliveryView {
    return {
      id: d.id,
      stage: deliveryStageOf(d),
      consignmentId: d.consignmentId,
      orderStatus: d.orderStatus,
      receivedAtWarehouseAt: d.receivedAtWarehouseAt?.toISOString() ?? null,
      dispatchedAt: d.dispatchedAt?.toISOString() ?? null,
      deliveredAt: d.deliveredAt?.toISOString() ?? null,
      cancelledAt: d.cancelledAt?.toISOString() ?? null,
      lastStatusCheckAt: d.lastStatusCheckAt?.toISOString() ?? null,
    };
  }

  // Decimal columns arrive from the driver as strings — every money/weight
  // field is coerced here so clients never see "120.00".
  private toAdminView(d: ProductDelivery): AdminDeliveryView {
    const payment = d.productPayment ?? null;
    const product = payment?.product ?? null;
    const buyer = payment?.winner ?? null;
    return {
      ...this.toBuyerView(d),
      productPaymentId: d.productPaymentId,
      product: product ? { id: product.id, title: product.title } : null,
      buyer: buyer
        ? { id: buyer.id, username: buyer.username, email: buyer.email }
        : null,
      referenceLabel: payment?.referenceLabel ?? null,
      itemAmount: payment ? Number(payment.amount) : null,
      deliveryCharge: Number(d.deliveryCharge),
      recipientName: d.recipientName,
      recipientPhone: d.recipientPhone,
      province: d.province,
      district: d.district,
      city: d.city,
      street: d.street,
      wardNumber: d.wardNumber,
      landmark: d.landmark,
      pathaoCityId: d.pathaoCityId,
      pathaoCityName: d.pathaoCityName,
      pathaoZoneId: d.pathaoZoneId,
      pathaoZoneName: d.pathaoZoneName,
      pathaoAreaId: d.pathaoAreaId,
      pathaoAreaName: d.pathaoAreaName,
      storeId: d.storeId,
      itemWeightKg: d.itemWeightKg === null ? null : Number(d.itemWeightKg),
      itemDescription: d.itemDescription,
      pathaoDeliveryFee:
        d.pathaoDeliveryFee === null ? null : Number(d.pathaoDeliveryFee),
      previousConsignmentIds: d.previousConsignmentIds ?? [],
      previousPathaoDeliveryFees: (d.previousPathaoDeliveryFees ?? []).map(
        (fee) => (fee === null ? null : Number(fee)),
      ),
      createdAt: d.createdAt.toISOString(),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private composeAddressText(delivery: ProductDelivery): string {
    const parts = [
      delivery.wardNumber ? `Ward ${delivery.wardNumber}` : null,
      delivery.street,
      delivery.city,
      delivery.district,
      delivery.province,
      delivery.landmark,
    ].filter((p): p is string => !!p);
    return parts.join(', ');
  }

  private async resolveProductTitle(
    delivery: ProductDelivery,
  ): Promise<string> {
    const payment = await this.paymentRepo.findOne({
      where: { id: delivery.productPaymentId },
    });
    if (!payment) return 'Item';
    const product = await this.productRepo.findOne({
      where: { id: payment.productId },
    });
    return product?.title ?? 'Item';
  }
}
