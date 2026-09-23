import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { IsNull, Not, Repository } from 'typeorm';
import { PaginatedResult } from '@common/types/paginated-result.type';
import { EventNames } from '@common/events/event-names';
import type { PaymentSucceededPayload } from '@common/events/event-payloads.type';
import { ShippingAddress } from '@modules/shipping/entities/shipping-address.entity';
import { ProductPayment } from '@modules/payments/entities/product-payment.entity';
import { Product } from '@modules/products/entities/product.entity';
import { ProductDelivery } from '../entities/product-delivery.entity';
import { PathaoClientService } from './pathao-client.service';
import type { DispatchDeliveryDto } from '../dto/pathao.dto';

// Pathao's own status vocabulary isn't confirmed from the sandbox docs we
// have — matched case-insensitively, and anything unrecognized is logged
// rather than silently ignored, so ops can tell us the real terminal string.
const DELIVERED_STATUS_MARKERS = ['delivered'];

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
    private readonly pathaoClientService: PathaoClientService,
    private readonly configService: ConfigService,
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

  async getOne(id: string): Promise<ProductDelivery> {
    return this.findOneOrThrow(id);
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
  ): Promise<ProductDelivery> {
    const delivery = await this.findOneOrThrow(id);
    if (delivery.receivedAtWarehouseAt) return delivery; // idempotent

    delivery.receivedAtWarehouseAt = new Date();
    delivery.receivedAtWarehouseById = adminId;
    return this.deliveryRepo.save(delivery);
  }

  async dispatch(
    id: string,
    adminId: string,
    dto: DispatchDeliveryDto,
  ): Promise<ProductDelivery> {
    const delivery = await this.findOneOrThrow(id);

    if (delivery.consignmentId) return delivery; // idempotent — already dispatched

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

    const storeId = this.configService.getOrThrow<number>('PATHAO_STORE_ID');

    const itemDescription =
      dto.itemDescription ?? (await this.resolveProductTitle(delivery));

    const result = await this.pathaoClientService.createOrder({
      storeId,
      merchantOrderId: delivery.id,
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

    delivery.storeId = storeId;
    delivery.consignmentId = result.consignmentId;
    delivery.pathaoDeliveryFee = result.deliveryFee;
    delivery.orderStatus = result.orderStatus;
    delivery.itemWeightKg = dto.itemWeightKg;
    delivery.itemDescription = itemDescription;
    delivery.dispatchedAt = new Date();
    delivery.dispatchedById = adminId;

    return this.deliveryRepo.save(delivery);
  }

  async syncStatus(id: string): Promise<ProductDelivery> {
    const delivery = await this.findOneOrThrow(id);
    if (!delivery.consignmentId) {
      throw new BadRequestException(
        'This delivery has not been dispatched yet',
      );
    }
    return this.refreshStatus(delivery);
  }

  /** Shared by syncStatus (manual) and the cron sweep (automatic). */
  async refreshStatus(delivery: ProductDelivery): Promise<ProductDelivery> {
    const info = await this.pathaoClientService.getOrderInfo(
      delivery.consignmentId!,
    );

    delivery.orderStatus = info.orderStatusSlug || info.orderStatus;
    delivery.lastStatusCheckAt = new Date();

    const isDelivered = DELIVERED_STATUS_MARKERS.includes(
      delivery.orderStatus.toLowerCase(),
    );
    if (isDelivered && !delivery.deliveredAt) {
      delivery.deliveredAt = new Date();
    } else if (!isDelivered) {
      this.logger.debug(
        `refreshStatus: delivery ${delivery.id} status is "${delivery.orderStatus}" (not recognized as terminal)`,
      );
    }

    return this.deliveryRepo.save(delivery);
  }

  async findDispatchedNotDelivered(): Promise<ProductDelivery[]> {
    return this.deliveryRepo.find({
      where: { consignmentId: Not(IsNull()), deliveredAt: IsNull() },
    });
  }

  // ─── Admin: listing ─────────────────────────────────────────────────────

  async listAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<ProductDelivery>> {
    const [data, total] = await this.deliveryRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
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
