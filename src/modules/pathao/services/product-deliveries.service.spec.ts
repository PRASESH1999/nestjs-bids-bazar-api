import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Repository } from 'typeorm';
import { NotificationType } from '@common/enums/notification-type.enum';
import { EventNames } from '@common/events/event-names';
import type { MailService } from '@modules/mail/mail.service';
import type { NotificationsService } from '@modules/notifications/notifications.service';
import type { ProductPayment } from '@modules/payments/entities/product-payment.entity';
import type { Product } from '@modules/products/entities/product.entity';
import type { ShippingAddress } from '@modules/shipping/entities/shipping-address.entity';
import type { User } from '@modules/users/entities/user.entity';
import { DeliveryStage } from '../dto/delivery-view.dto';
import { classifyPathaoStatus, deliveryStageOf } from '../delivery-stage.util';
import type { ProductDelivery } from '../entities/product-delivery.entity';
import type { PathaoClientService } from './pathao-client.service';
import { ProductDeliveriesService } from './product-deliveries.service';

function makeDelivery(
  overrides: Partial<ProductDelivery> = {},
): ProductDelivery {
  return {
    id: 'delivery-1',
    productPaymentId: 'pay-1',
    receivedAtWarehouseAt: new Date('2026-09-30T00:00:00Z'),
    consignmentId: 'DT-FIRST',
    pathaoDeliveryFee: 85,
    orderStatus: 'Pending',
    deliveredAt: null,
    cancelledAt: null,
    previousConsignmentIds: [],
    previousPathaoDeliveryFees: [],
    pathaoCityId: 1,
    pathaoZoneId: 2,
    pathaoAreaId: null,
    recipientName: 'Buyer',
    recipientPhone: '9800000000',
    deliveryCharge: 150,
    amountToCollect: 0,
    returnedAt: null,
    createdAt: new Date('2026-09-30T00:00:00Z'),
    ...overrides,
  } as ProductDelivery;
}

function setup(delivery: ProductDelivery, pathaoStatus: string) {
  const deliveryRepo = {
    findOne: jest.fn().mockResolvedValue(delivery),
    save: jest.fn((d: ProductDelivery) => Promise.resolve(d)),
    create: jest.fn((d: Partial<ProductDelivery>) => d),
    // toAdminViewById — the view itself is not under test here.
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      for (const m of ['leftJoinAndSelect', 'leftJoin', 'addSelect', 'where'])
        qb[m] = jest.fn(() => qb);
      qb.getOne = jest.fn().mockResolvedValue(delivery);
      return qb;
    }),
  };
  const paymentRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'pay-1',
      productId: 'product-1',
      winnerUserId: 'buyer-1',
    }),
  };
  const productRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'product-1', title: 'Camera' }),
  };
  const userRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'buyer-1', username: 'buyer' }),
  };
  const pathao = {
    getOrderInfo: jest.fn().mockResolvedValue({
      orderStatusSlug: pathaoStatus,
      orderStatus: pathaoStatus,
    }),
    isServiceable: jest.fn().mockReturnValue(true),
    createOrder: jest.fn().mockResolvedValue({
      consignmentId: 'DT-SECOND',
      deliveryFee: 95,
      orderStatus: 'Pending',
    }),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue(12345) };
  const notifications = { createForUser: jest.fn() };
  const mail = { sendDeliveryCancelledAdmin: jest.fn() };
  const addressRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'addr-1',
      recipientName: 'Buyer',
      recipientPhone: '9800000000',
      province: 'Bagmati',
      district: 'Kathmandu',
      city: 'Kathmandu',
      street: 'New Road',
      wardNumber: '1',
      landmark: null,
      pathaoCityId: 1,
      pathaoCityName: 'Kathmandu',
      pathaoZoneId: 2,
      pathaoZoneName: 'New Road',
      pathaoAreaId: null,
      pathaoAreaName: null,
    }),
  };
  const eventEmitter = { emit: jest.fn() };

  const service = new ProductDeliveriesService(
    deliveryRepo as unknown as Repository<ProductDelivery>,
    addressRepo as unknown as Repository<ShippingAddress>,
    paymentRepo as unknown as Repository<ProductPayment>,
    productRepo as unknown as Repository<Product>,
    userRepo as unknown as Repository<User>,
    pathao as unknown as PathaoClientService,
    config as unknown as ConfigService,
    notifications as unknown as NotificationsService,
    mail as unknown as MailService,
    eventEmitter as unknown as EventEmitter2,
  );
  return { service, deliveryRepo, notifications, mail, pathao, eventEmitter };
}

describe('ProductDeliveriesService.refreshStatus — cancellation is announced (A57)', () => {
  it('tells the buyer and the support mailbox the first time a cancellation is seen', async () => {
    const delivery = makeDelivery();
    const { service, notifications, mail } = setup(
      delivery,
      'Pickup_Cancelled',
    );

    await service.refreshStatus(delivery);

    expect(delivery.cancelledAt).toBeInstanceOf(Date);
    expect(notifications.createForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'buyer-1',
        type: NotificationType.DELIVERY_CANCELLED,
        relatedId: 'product-1',
        title: "Your courier order was cancelled — we're rebooking it",
        data: { productId: 'product-1' },
      }),
    );
    expect(mail.sendDeliveryCancelledAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'delivery-1',
        consignmentId: 'DT-FIRST',
        productTitle: 'Camera',
        buyerUsername: 'buyer',
      }),
    );
  });

  it('stays quiet on a re-sync of an order already known to be cancelled', async () => {
    const delivery = makeDelivery({
      cancelledAt: new Date('2026-10-01T00:00:00Z'),
    });
    const { service, notifications, mail } = setup(
      delivery,
      'Pickup_Cancelled',
    );

    await service.refreshStatus(delivery);

    expect(notifications.createForUser).not.toHaveBeenCalled();
    expect(mail.sendDeliveryCancelledAdmin).not.toHaveBeenCalled();
  });

  it('does not let a failed notification undo the status change', async () => {
    const delivery = makeDelivery();
    const { service, deliveryRepo, notifications } = setup(
      delivery,
      'Cancelled',
    );
    notifications.createForUser.mockRejectedValue(new Error('db down'));

    await expect(service.refreshStatus(delivery)).resolves.toBe(delivery);
    expect(deliveryRepo.save).toHaveBeenCalled();
  });
});

describe('ProductDeliveriesService.redispatch — keeps the cancelled order fee (A57)', () => {
  it('moves the old fee into previousPathaoDeliveryFees, aligned with the consignment', async () => {
    const delivery = makeDelivery({
      cancelledAt: new Date('2026-10-01T00:00:00Z'),
    });
    const { service } = setup(delivery, 'Pickup_Cancelled');

    await service.redispatch('delivery-1', 'admin-1', {
      itemWeightKg: 1,
      itemDescription: 'Camera',
    });

    expect(delivery.previousConsignmentIds).toEqual(['DT-FIRST']);
    expect(delivery.previousPathaoDeliveryFees).toEqual([85]);
    expect(delivery.consignmentId).toBe('DT-SECOND');
    expect(delivery.pathaoDeliveryFee).toBe(95);
    expect(delivery.cancelledAt).toBeNull();
  });
});

describe('ProductDeliveriesService — cash on delivery', () => {
  it('creates a COD delivery with item + delivery as the amount to collect', async () => {
    const { service, deliveryRepo } = setup(makeDelivery(), 'Pending');
    deliveryRepo.findOne.mockResolvedValueOnce(null);

    await service.onCodConfirmed({
      productId: 'product-1',
      paymentId: 'pay-cod',
      referenceLabel: 'REFCOD',
      winnerUserId: 'buyer-1',
      amount: 1200,
      deliveryCharge: 120,
      shippingAddressId: 'addr-1',
    });

    expect(deliveryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        productPaymentId: 'pay-cod',
        deliveryCharge: 120,
        amountToCollect: 1320,
      }),
    );
  });

  it('creates a prepaid delivery with nothing to collect', async () => {
    const { service, deliveryRepo } = setup(makeDelivery(), 'Pending');
    deliveryRepo.findOne.mockResolvedValueOnce(null);

    await service.onPaymentSucceeded({
      productId: 'product-1',
      paymentId: 'pay-1',
      referenceLabel: 'REF1',
      winnerUserId: 'buyer-1',
      fonepayTraceId: 'TRACE',
      amount: 1200,
      deliveryCharge: 120,
      shippingAddressId: 'addr-1',
    });

    expect(deliveryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ amountToCollect: 0 }),
    );
  });

  it('sends the stored amount to collect to Pathao on (re)dispatch', async () => {
    const delivery = makeDelivery({
      cancelledAt: new Date('2026-10-01T00:00:00Z'),
      // Decimal columns arrive from the driver as strings.
      amountToCollect: '1320.00' as unknown as number,
    });
    const { service, pathao } = setup(delivery, 'Pickup_Cancelled');

    await service.redispatch('delivery-1', 'admin-1', {
      itemWeightKg: 1,
      itemDescription: 'Camera',
    });

    expect(pathao.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountToCollect: 1320 }),
    );
  });

  it('refuses to redispatch a parcel that came back refused', async () => {
    const delivery = makeDelivery({
      cancelledAt: new Date('2026-10-01T00:00:00Z'),
      returnedAt: new Date('2026-10-02T00:00:00Z'),
    });
    const { service, pathao } = setup(delivery, 'Pickup_Cancelled');

    await expect(
      service.redispatch('delivery-1', 'admin-1', {
        itemWeightKg: 1,
        itemDescription: 'Camera',
      }),
    ).rejects.toThrow('returned refused');
    expect(pathao.createOrder).not.toHaveBeenCalled();
  });

  it('announces delivery.completed the first time Pathao reports delivered', async () => {
    const delivery = makeDelivery();
    const { service, eventEmitter } = setup(delivery, 'Delivered');

    await service.refreshStatus(delivery);

    expect(delivery.deliveredAt).toBeInstanceOf(Date);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventNames.DELIVERY_COMPLETED,
      { deliveryId: 'delivery-1', productPaymentId: 'pay-1' },
    );
  });

  it('does not re-announce a delivery already on record', async () => {
    const delivery = makeDelivery({
      deliveredAt: new Date('2026-10-01T00:00:00Z'),
    });
    const { service, eventEmitter } = setup(delivery, 'Delivered');

    await service.refreshStatus(delivery);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});

describe('deliveryStageOf / classifyPathaoStatus', () => {
  it('reports a refused COD parcel as RETURNED, even with a cancelled order', () => {
    expect(
      deliveryStageOf(
        makeDelivery({
          cancelledAt: new Date('2026-10-01T00:00:00Z'),
          returnedAt: new Date('2026-10-02T00:00:00Z'),
        }),
      ),
    ).toBe(DeliveryStage.RETURNED);
  });

  it('reports a cancelled courier order as CANCELLED, not IN_TRANSIT (A56)', () => {
    expect(
      deliveryStageOf(
        makeDelivery({ cancelledAt: new Date('2026-10-01T00:00:00Z') }),
      ),
    ).toBe(DeliveryStage.CANCELLED);
    expect(deliveryStageOf(makeDelivery())).toBe(DeliveryStage.IN_TRANSIT);
  });

  it('matches "cancel" as a substring and "delivered" exactly', () => {
    expect(classifyPathaoStatus('Pickup_Cancelled').isCancelled).toBe(true);
    expect(classifyPathaoStatus('Delivered').isDelivered).toBe(true);
    expect(classifyPathaoStatus('Delivery_Failed')).toEqual({
      isDelivered: false,
      isCancelled: false,
    });
  });
});
