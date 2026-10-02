import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { DataSource, Repository } from 'typeorm';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { EventNames } from '@common/events/event-names';
import type { AuctionLifecycleService } from '@modules/bidding/services/auction-lifecycle.service';
import type { Bid } from '@modules/bidding/entities/bid.entity';
import type { ProductSettlement } from '@modules/bidding/entities/product-settlement.entity';
import type { FonepayClientService } from '@modules/fonepay/services/fonepay-client.service';
import type { PathaoClientService } from '@modules/pathao/services/pathao-client.service';
import type { ProductDeliveriesService } from '@modules/pathao/services/product-deliveries.service';
import type { Product } from '@modules/products/entities/product.entity';
import type { ShippingService } from '@modules/shipping/shipping.service';
import type { ProductPayment } from '../entities/product-payment.entity';
import { PaymentsService } from './payments.service';

/*
 * confirmSuccess is where a gateway "paid" signal turns into a settled sale,
 * a delivery and a seller payout. These cover the one case where it must NOT:
 * a second payment for a sale that is already settled.
 */

function makePayment(overrides: Partial<ProductPayment> = {}): ProductPayment {
  return {
    id: 'pay-gateway',
    productId: 'product-1',
    productSettlementId: 'round-1',
    winnerUserId: 'buyer-1',
    referenceLabel: 'REF123',
    amount: 1000,
    deliveryCharge: 120,
    shippingAddressId: 'addr-1',
    status: PaymentStatus.PENDING,
    ...overrides,
  } as ProductPayment;
}

function setup(payment: ProductPayment, otherSuccess: ProductPayment | null) {
  const paymentRepo = {
    findOne: jest.fn(({ where }: { where: { id?: unknown } }) =>
      // By-id lookup returns the payment under test; the "another SUCCESS
      // payment for this product" lookup uses Not(id), which is an object.
      typeof where.id === 'string'
        ? Promise.resolve(payment)
        : Promise.resolve(otherSuccess),
    ),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const lifecycle = {
    confirmPaymentGateway: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };

  const service = new PaymentsService(
    paymentRepo as unknown as Repository<ProductPayment>,
    {} as Repository<Bid>,
    {} as Repository<Product>,
    {} as Repository<ProductSettlement>,
    {} as DataSource,
    {} as FonepayClientService,
    lifecycle as unknown as AuctionLifecycleService,
    {} as ShippingService,
    {} as PathaoClientService,
    {} as ProductDeliveriesService,
    eventEmitter as unknown as EventEmitter2,
    {} as ConfigService,
  );
  return { service, paymentRepo, lifecycle, eventEmitter };
}

describe('PaymentsService.confirmSuccess', () => {
  it('settles and emits PAYMENT_SUCCEEDED for the live attempt', async () => {
    const { service, paymentRepo, lifecycle, eventEmitter } = setup(
      makePayment(),
      null,
    );
    lifecycle.confirmPaymentGateway.mockResolvedValue({});

    await service.confirmSuccess('pay-gateway');

    expect(lifecycle.confirmPaymentGateway).toHaveBeenCalledWith(
      'product-1',
      'round-1',
      120,
    );
    expect(paymentRepo.update).toHaveBeenCalledWith(
      'pay-gateway',
      expect.objectContaining({ status: PaymentStatus.SUCCESS }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventNames.PAYMENT_SUCCEEDED,
      expect.objectContaining({
        paymentId: 'pay-gateway',
        deliveryCharge: 120,
      }),
    );
  });

  it('flags a payment retired by manual confirmation for refund, settling nothing', async () => {
    const { service, paymentRepo, lifecycle, eventEmitter } = setup(
      makePayment({ status: PaymentStatus.EXPIRED }),
      null,
    );

    await service.confirmSuccess('pay-gateway');

    expect(lifecycle.confirmPaymentGateway).not.toHaveBeenCalled();
    const [[id, patch]] = paymentRepo.update.mock.calls as [
      string,
      Partial<ProductPayment>,
    ][];
    expect(id).toBe('pay-gateway');
    expect(patch.status).toBe(PaymentStatus.FAILED);
    expect(patch.paymentMessage).toContain('REFUND DUE');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('flags a second payment when another payment already settled the sale', async () => {
    const { service, paymentRepo, lifecycle, eventEmitter } = setup(
      makePayment(),
      makePayment({ id: 'pay-manual', status: PaymentStatus.SUCCESS }),
    );
    lifecycle.confirmPaymentGateway.mockRejectedValue(
      new BadRequestException(
        'Product is not awaiting payment (status: SETTLED)',
      ),
    );

    await service.confirmSuccess('pay-gateway');

    expect(paymentRepo.update).toHaveBeenCalledWith(
      'pay-gateway',
      expect.objectContaining({ status: PaymentStatus.FAILED }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('still treats "already settled" by this same payment as success (duplicate socket message)', async () => {
    const { service, paymentRepo, lifecycle, eventEmitter } = setup(
      makePayment(),
      null,
    );
    lifecycle.confirmPaymentGateway.mockRejectedValue(
      new BadRequestException(
        'Product is not awaiting payment (status: SETTLED)',
      ),
    );

    await service.confirmSuccess('pay-gateway');

    expect(paymentRepo.update).toHaveBeenCalledWith(
      'pay-gateway',
      expect.objectContaining({ status: PaymentStatus.SUCCESS }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventNames.PAYMENT_SUCCEEDED,
      expect.anything(),
    );
  });
});
