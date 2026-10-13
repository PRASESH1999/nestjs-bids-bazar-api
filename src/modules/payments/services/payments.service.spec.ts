import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { DataSource, Repository } from 'typeorm';
import { PaymentMethod } from '@common/enums/payment-method.enum';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
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

/*
 * Cash on delivery — auction winners only, never Instant Buy. The sale
 * settles when COD is chosen; the payment only becomes SUCCESS (releasing the
 * seller payout) once Pathao reports the parcel delivered.
 */
function setupCod(
  opts: {
    product?: Partial<Product>;
    bid?: Partial<Bid> | null;
    codRefusalCount?: number;
    payment?: ProductPayment | null;
    pending?: ProductPayment | null;
    config?: Record<string, number>;
  } = {},
) {
  const product = {
    id: 'product-1',
    status: ProductStatus.AWAITING_PAYMENT,
    ...opts.product,
  };
  const bid =
    opts.bid === null
      ? null
      : {
          id: 'bid-1',
          bidderId: 'buyer-1',
          amount: 1200,
          isInstantBuy: false,
          paymentDeadline: new Date(Date.now() + 3_600_000),
          ...opts.bid,
        };
  const config: Record<string, number> = {
    DELIVERY_CHARGE_FLAT: 120,
    COD_MAX_AMOUNT: 50000,
    COD_MAX_REFUSALS: 2,
    ...opts.config,
  };

  const paymentRepo = {
    findOne: jest.fn(({ where }: { where: { status?: unknown } }) =>
      Promise.resolve(
        where.status === PaymentStatus.PENDING
          ? (opts.pending ?? null)
          : (opts.payment ?? null),
      ),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const productRepo = { findOne: jest.fn().mockResolvedValue(product) };
  const bidRepo = { findOne: jest.fn().mockResolvedValue(bid) };
  const userRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'buyer-1',
      codRefusalCount: opts.codRefusalCount ?? 0,
    }),
  };
  const dataSource = { getRepository: jest.fn(() => userRepo) };
  const lifecycle = {
    confirmCod: jest.fn(),
    abandonAfterCodRefusal: jest.fn(),
    confirmPaymentGateway: jest.fn(),
  };
  const fonepay = { getPaymentStatus: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const configService = {
    getOrThrow: jest.fn((key: string) => config[key]),
  };

  const service = new PaymentsService(
    paymentRepo as unknown as Repository<ProductPayment>,
    bidRepo as unknown as Repository<Bid>,
    productRepo as unknown as Repository<Product>,
    {} as Repository<ProductSettlement>,
    dataSource as unknown as DataSource,
    fonepay as unknown as FonepayClientService,
    lifecycle as unknown as AuctionLifecycleService,
    {} as ShippingService,
    {} as PathaoClientService,
    {} as ProductDeliveriesService,
    eventEmitter as unknown as EventEmitter2,
    configService as unknown as ConfigService,
  );
  return { service, paymentRepo, lifecycle, fonepay, eventEmitter };
}

describe('PaymentsService.getCodEligibility', () => {
  it('offers COD to the auction winner, quoting item + delivery', async () => {
    const { service } = setupCod();

    const res = await service.getCodEligibility('product-1', 'buyer-1');

    expect(res).toEqual({
      available: true,
      reason: null,
      itemAmount: 1200,
      deliveryCharge: 120,
      amount: 1320,
      maxAmount: 50000,
    });
  });

  it('never offers COD during an Instant Buy hold', async () => {
    const { service } = setupCod({
      product: { status: ProductStatus.AWAITING_INSTANT_BUY },
    });

    const res = await service.getCodEligibility('product-1', 'buyer-1');

    expect(res.available).toBe(false);
    expect(res.reason).toContain('Instant Buy');
  });

  it('never offers COD on an Instant Buy bid', async () => {
    const { service } = setupCod({ bid: { isInstantBuy: true } });

    const res = await service.getCodEligibility('product-1', 'buyer-1');

    expect(res.available).toBe(false);
    expect(res.reason).toContain('Instant Buy');
  });

  it('refuses orders above COD_MAX_AMOUNT', async () => {
    const { service } = setupCod({ config: { COD_MAX_AMOUNT: 1000 } });

    const res = await service.getCodEligibility('product-1', 'buyer-1');

    expect(res.available).toBe(false);
    expect(res.reason).toContain('up to 1000');
  });

  it('withdraws COD from a buyer at COD_MAX_REFUSALS refused parcels', async () => {
    const { service } = setupCod({ codRefusalCount: 2 });

    const res = await service.getCodEligibility('product-1', 'buyer-1');

    expect(res.available).toBe(false);
    expect(res.reason).toContain('refused deliveries');
  });

  it('rejects a caller who is not the current winner', async () => {
    const { service } = setupCod({ bid: { bidderId: 'someone-else' } });

    await expect(
      service.getCodEligibility('product-1', 'buyer-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('PaymentsService.confirmCod', () => {
  it('does not settle anything when COD is unavailable', async () => {
    const { service, lifecycle } = setupCod({ bid: { isInstantBuy: true } });

    await expect(
      service.confirmCod('product-1', 'buyer-1', {
        shippingAddressId: 'addr-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(lifecycle.confirmCod).not.toHaveBeenCalled();
  });

  it('settles via the paid Fonepay attempt instead, and refuses COD', async () => {
    const pending = makePayment();
    const { service, lifecycle, fonepay } = setupCod({ pending });
    fonepay.getPaymentStatus.mockResolvedValue({ paymentStatus: 'success' });
    const confirmSuccess = jest
      .spyOn(service, 'confirmSuccess')
      .mockResolvedValue(undefined);

    await expect(
      service.confirmCod('product-1', 'buyer-1', {
        shippingAddressId: 'addr-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(confirmSuccess).toHaveBeenCalledWith(
      'pay-gateway',
      expect.anything(),
    );
    expect(lifecycle.confirmCod).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.markCodCollected', () => {
  const codPayment = (overrides: Partial<ProductPayment> = {}) =>
    makePayment({
      id: 'pay-cod',
      method: PaymentMethod.COD,
      status: PaymentStatus.COD_PENDING,
      ...overrides,
    });

  it('turns a delivered COD payment into SUCCESS and announces it', async () => {
    const { service, paymentRepo, eventEmitter } = setupCod({
      payment: codPayment(),
    });

    await service.markCodCollected('pay-cod');

    expect(paymentRepo.update).toHaveBeenCalledWith(
      { id: 'pay-cod', status: PaymentStatus.COD_PENDING },
      expect.objectContaining({ status: PaymentStatus.SUCCESS }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EventNames.PAYMENT_SUCCEEDED,
      expect.objectContaining({ paymentId: 'pay-cod', amount: 1000 }),
    );
  });

  it('ignores a prepaid delivery', async () => {
    const { service, paymentRepo, eventEmitter } = setupCod({
      payment: makePayment({ status: PaymentStatus.SUCCESS }),
    });

    await service.markCodCollected('pay-gateway');

    expect(paymentRepo.update).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('stays quiet when a refusal won the race', async () => {
    const { service, paymentRepo, eventEmitter } = setupCod({
      payment: codPayment(),
    });
    paymentRepo.update.mockResolvedValue({ affected: 0 });

    await service.markCodCollected('pay-cod');

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
