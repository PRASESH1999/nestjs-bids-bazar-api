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
import { StaleSettlementRoundException } from '@modules/bidding/stale-settlement-round.exception';
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

/*
 * A50 / A55 — a gateway "paid" for a round that is over must be flagged for a
 * refund, not just logged (and later expired by the cron as if unpaid).
 * A54 — a gateway FAILED on an Instant Buy hold releases the hold.
 */
function setupFull(payment: ProductPayment) {
  const paymentRepo = {
    // By id, or the buyer's own pending attempt — both are the payment under
    // test. The "another SUCCESS payment" lookup (Not(id)) finds nothing.
    findOne: jest.fn(
      ({ where }: { where: { id?: unknown; winnerUserId?: unknown } }) =>
        typeof where.id === 'string' || where.winnerUserId !== undefined
          ? Promise.resolve(payment)
          : Promise.resolve(null),
    ),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const lifecycle = {
    confirmPaymentGateway: jest.fn(),
    releaseInstantBuyHold: jest.fn().mockResolvedValue(undefined),
    startInstantBuyHold: jest.fn(),
  };
  const fonepay = { getPaymentStatus: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const shipping = { getOwned: jest.fn().mockResolvedValue({}) };

  const service = new PaymentsService(
    paymentRepo as unknown as Repository<ProductPayment>,
    {} as Repository<Bid>,
    {} as Repository<Product>,
    {} as Repository<ProductSettlement>,
    {} as DataSource,
    fonepay as unknown as FonepayClientService,
    lifecycle as unknown as AuctionLifecycleService,
    shipping as unknown as ShippingService,
    {} as PathaoClientService,
    {} as ProductDeliveriesService,
    eventEmitter as unknown as EventEmitter2,
    {} as ConfigService,
  );
  return { service, paymentRepo, lifecycle, fonepay, eventEmitter };
}

function lastPatch(paymentRepo: {
  update: jest.Mock;
}): Partial<ProductPayment> {
  const calls = paymentRepo.update.mock.calls as [
    string,
    Partial<ProductPayment>,
  ][];
  return calls[calls.length - 1][1];
}

describe('PaymentsService.confirmSuccess — paid after the round ended (A50, A55)', () => {
  it('flags a payment whose round was superseded or whose hold lapsed for refund', async () => {
    const { service, paymentRepo, lifecycle, eventEmitter } =
      setupFull(makePayment());
    lifecycle.confirmPaymentGateway.mockRejectedValue(
      new StaleSettlementRoundException(
        'Product is not awaiting payment (status: ACTIVE)',
      ),
    );

    await service.confirmSuccess('pay-gateway', {
      fonepayTraceId: 'TRACE-1',
    } as never);

    const patch = lastPatch(paymentRepo);
    expect(patch.status).toBe(PaymentStatus.FAILED);
    expect(patch.paymentMessage).toMatch(
      /^REFUND DUE — paid after this round had ended/,
    );
    expect(patch.fonepayTraceId).toBe('TRACE-1');
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('flags an already-EXPIRED attempt that turns out paid, with the window-closed reason', async () => {
    const { service, paymentRepo, lifecycle } = setupFull(
      makePayment({ status: PaymentStatus.EXPIRED }),
    );

    await service.confirmSuccess('pay-gateway');

    expect(lifecycle.confirmPaymentGateway).not.toHaveBeenCalled();
    expect(lastPatch(paymentRepo).paymentMessage).toMatch(
      /^REFUND DUE — paid after this payment window had closed/,
    );
  });
});

describe('PaymentsService.expirePayment — asks Fonepay before giving up (A50, A55)', () => {
  it('routes a payment Fonepay reports paid through confirmSuccess instead of expiring it', async () => {
    const { service, paymentRepo, lifecycle, fonepay } =
      setupFull(makePayment());
    fonepay.getPaymentStatus.mockResolvedValue({ paymentStatus: 'success' });
    lifecycle.confirmPaymentGateway.mockRejectedValue(
      new StaleSettlementRoundException('round over'),
    );

    await service.expirePayment('pay-gateway');

    expect(lastPatch(paymentRepo).status).toBe(PaymentStatus.FAILED);
    expect(lastPatch(paymentRepo).paymentMessage).toContain('REFUND DUE');
  });

  it('still expires the row when Fonepay is unreachable', async () => {
    const { service, paymentRepo, fonepay } = setupFull(makePayment());
    fonepay.getPaymentStatus.mockRejectedValue(new Error('timeout'));

    await service.expirePayment('pay-gateway');

    expect(paymentRepo.update).toHaveBeenCalledWith('pay-gateway', {
      status: PaymentStatus.EXPIRED,
    });
  });
});

describe('PaymentsService.markFailed — Instant Buy hold (A54)', () => {
  it("releases the hold for the failed payment's own round", async () => {
    const { service, lifecycle, eventEmitter } = setupFull(makePayment());

    await service.markFailed('pay-gateway', 'Declined');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventNames.PAYMENT_FAILED,
      expect.objectContaining({ paymentId: 'pay-gateway' }),
    );
    expect(lifecycle.releaseInstantBuyHold).toHaveBeenCalledWith(
      'product-1',
      'round-1',
    );
  });

  it('leaves the product alone when the failed row was no longer live', async () => {
    const { service, lifecycle } = setupFull(
      makePayment({ status: PaymentStatus.EXPIRED }),
    );

    await service.markFailed('pay-gateway', 'Declined');

    expect(lifecycle.releaseInstantBuyHold).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.initiateInstantBuyPayment — idempotent while the hold is live', () => {
  it("returns the buyer's existing QR instead of starting a second hold", async () => {
    const live = makePayment({
      paymentDeadline: new Date(Date.now() + 120_000),
      qrString: 'QR-PAYLOAD',
      shippingAddressId: null,
    });
    const { service, lifecycle } = setupFull(live);

    const res = await service.initiateInstantBuyPayment(
      'product-1',
      'buyer-1',
      { shippingAddressId: 'addr-1' },
    );

    expect(lifecycle.startInstantBuyHold).not.toHaveBeenCalled();
    expect(res.paymentId).toBe('pay-gateway');
    expect(res.qrString).toBe('QR-PAYLOAD');
  });
});
