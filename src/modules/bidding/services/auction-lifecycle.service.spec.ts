import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ProductStatus } from '@common/enums/product-status.enum';
import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';
import { PaymentConfirmationMethod } from '@common/enums/payment-confirmation-method.enum';
import { PaymentMethod } from '@common/enums/payment-method.enum';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { SettlementStatus } from '@common/enums/settlement-status.enum';
import { EventNames } from '@common/events/event-names';
import { ProductPayment } from '@modules/payments/entities/product-payment.entity';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { ProductDelivery } from '@modules/pathao/entities/product-delivery.entity';
import { MailService } from '@modules/mail/mail.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Bid } from '../entities/bid.entity';
import { ProductSettlement } from '../entities/product-settlement.entity';
import { ShippingService } from '@modules/shipping/shipping.service';
import { PathaoClientService } from '@modules/pathao/services/pathao-client.service';
import { StaleSettlementRoundException } from '../stale-settlement-round.exception';
import { AuctionLifecycleService } from './auction-lifecycle.service';

// Same fluent-stub approach as bidding.service.spec.ts — every chain method
// returns `this`; only the terminal method actually used resolves a value.
function makeQueryBuilder(terminals: Record<string, unknown>) {
  const qb: Record<string, jest.Mock> = {
    setLock: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
  };
  for (const key of Object.keys(qb)) {
    qb[key].mockReturnValue(qb);
  }
  for (const [method, value] of Object.entries(terminals)) {
    qb[method] = jest.fn().mockResolvedValue(value);
  }
  return qb;
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    ownerId: 'owner-1',
    title: 'A product',
    status: ProductStatus.ACTIVE,
    currentHighestBid: 1000,
    currentHighestBidderId: 'bidder-1',
    biddingEndPrice: 2000,
    biddingEndsAt: new Date('2099-01-01T00:00:00Z'), // far future by default
    ...overrides,
  } as Product;
}

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: 'bid-1',
    productId: 'product-1',
    bidderId: 'bidder-1',
    amount: 1000,
    isOriginalWinner: false,
    fallbackRank: null,
    isCurrentlyPaymentResponsible: false,
    paymentStatus: BidPaymentStatus.NOT_RESPONSIBLE,
    paymentDeadline: null,
    ...overrides,
  } as Bid;
}

const configService = {
  getOrThrow: jest.fn((key: string) => {
    if (key === 'PAYMENT_WINDOW_HOURS') return 18;
    throw new Error(`Unexpected config key requested in test: ${key}`);
  }),
} as unknown as ConfigService;

const mailService = {} as unknown as MailService;
const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
const notificationsService = {} as unknown as NotificationsService;

function buildService(product: Product, highestBid: Bid | null) {
  const productRepo = {
    createQueryBuilder: jest.fn(() => makeQueryBuilder({ getOne: product })),
    save: jest.fn((p: Product) => p),
  };
  const bidRepo = {
    createQueryBuilder: jest.fn(() => makeQueryBuilder({ getOne: highestBid })),
    save: jest.fn((b: Bid) => b),
  };
  const settlementRepo = {
    create: jest.fn((s: Partial<ProductSettlement>) => s as ProductSettlement),
    save: jest.fn((s: ProductSettlement) => s),
    findOne: jest.fn().mockResolvedValue(null),
  };

  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Product) return productRepo;
        if (entity === Bid) return bidRepo;
        if (entity === ProductSettlement) return settlementRepo;
        throw new Error('Unexpected repository requested in test');
      }),
    },
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => qr),
    // Post-commit email lookups — resolve null so mail sending is skipped.
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(null),
    })),
  } as unknown as DataSource;

  const service = new AuctionLifecycleService(
    dataSource,
    configService,
    mailService,
    eventEmitter,
    notificationsService,
    // Only confirmPaymentManual / getWinnerAddresses touch these; the
    // lifecycle transitions under test never do.
    {} as unknown as ShippingService,
    {} as unknown as PathaoClientService,
  );

  return { service, qr, productRepo, bidRepo, settlementRepo };
}

describe('AuctionLifecycleService.closeIfExpired — two independent close triggers', () => {
  it('does nothing when neither the timer expired nor biddingEndPrice was reached', async () => {
    const product = makeProduct({
      currentHighestBid: 1000,
      biddingEndPrice: 2000,
      biddingEndsAt: new Date('2099-01-01T00:00:00Z'),
    });
    const { service, qr, productRepo, bidRepo } = buildService(
      product,
      makeBid(),
    );

    await service.closeIfExpired('product-1');

    expect(productRepo.save).not.toHaveBeenCalled();
    expect(bidRepo.save).not.toHaveBeenCalled();
    expect(qr.commitTransaction).toHaveBeenCalled();
  });

  it('closes the auction when the countdown timer has expired', async () => {
    const product = makeProduct({
      currentHighestBid: 1000,
      biddingEndPrice: 2000,
      biddingEndsAt: new Date('2000-01-01T00:00:00Z'), // in the past
    });
    const highestBid = makeBid({ amount: 1000 });
    const { service, productRepo, bidRepo, settlementRepo } = buildService(
      product,
      highestBid,
    );

    await service.closeIfExpired('product-1');

    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ProductStatus.AWAITING_PAYMENT }),
    );
    expect(bidRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isCurrentlyPaymentResponsible: true,
        paymentStatus: BidPaymentStatus.PENDING,
      }),
    );
    expect(settlementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackRank: 0, bidId: highestBid.id }),
    );
  });

  it('closes the auction immediately once a regular bid reaches biddingEndPrice, even with time left on the timer', async () => {
    const product = makeProduct({
      currentHighestBid: 2000,
      biddingEndPrice: 2000, // ceiling reached exactly
      biddingEndsAt: new Date('2099-01-01T00:00:00Z'), // far from expiring
    });
    const highestBid = makeBid({ amount: 2000 });
    const { service, productRepo, bidRepo } = buildService(product, highestBid);

    await service.closeIfExpired('product-1');

    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ProductStatus.AWAITING_PAYMENT }),
    );
    expect(bidRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isCurrentlyPaymentResponsible: true,
        paymentStatus: BidPaymentStatus.PENDING,
        fallbackRank: 0,
      }),
    );
  });

  it('does not close when the current bid is still below biddingEndPrice', async () => {
    const product = makeProduct({
      currentHighestBid: 1995,
      biddingEndPrice: 2000,
      biddingEndsAt: new Date('2099-01-01T00:00:00Z'),
    });
    const { service, productRepo, bidRepo } = buildService(product, makeBid());

    await service.closeIfExpired('product-1');

    expect(productRepo.save).not.toHaveBeenCalled();
    expect(bidRepo.save).not.toHaveBeenCalled();
  });
});

describe('AuctionLifecycleService.closeIfExpired — Instant Buy hold bids (A53)', () => {
  it('never picks a lapsed Instant Buy hold bid as the auction winner', async () => {
    const product = makeProduct({
      biddingEndsAt: new Date('2000-01-01T00:00:00Z'),
    });
    const { service, bidRepo } = buildService(product, makeBid());

    await service.closeIfExpired('product-1');

    const qb = bidRepo.createQueryBuilder.mock.results[0].value as {
      andWhere: jest.Mock;
    };
    expect(qb.andWhere).toHaveBeenCalledWith('bid.isInstantBuy = false');
  });
});

/*
 * A54 — a gateway-FAILED Instant Buy payment releases the hold at once, and
 * does not count as the buyer's one failed attempt. A50/A55 — a confirmation
 * for a round that is over is a StaleSettlementRoundException, which the
 * payments side turns into a refund flag.
 */
function buildHoldService(opts: {
  product: Product;
  holdBid: Bid | null;
  settlement: Partial<ProductSettlement> | null;
  paymentRows: number;
  realHighestBid?: Bid | null;
}) {
  const emit = jest.fn();
  const productRepo = {
    createQueryBuilder: jest.fn(() =>
      makeQueryBuilder({ getOne: opts.product }),
    ),
    save: jest.fn((p: Product) => p),
  };
  const bidRepo = {
    findOne: jest.fn().mockResolvedValue(opts.holdBid),
    createQueryBuilder: jest.fn(() =>
      makeQueryBuilder({ getOne: opts.realHighestBid ?? null }),
    ),
    save: jest.fn((b: Bid) => b),
    delete: jest.fn(),
  };
  const settlementRepo = {
    findOne: jest.fn().mockResolvedValue(opts.settlement),
    save: jest.fn((x: ProductSettlement) => x),
    delete: jest.fn(),
  };
  const paymentRepo = { count: jest.fn().mockResolvedValue(opts.paymentRows) };

  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Product) return productRepo;
        if (entity === Bid) return bidRepo;
        if (entity === ProductSettlement) return settlementRepo;
        if (entity === ProductPayment) return paymentRepo;
        throw new Error('Unexpected repository requested in test');
      }),
    },
  };

  const service = new AuctionLifecycleService(
    { createQueryRunner: jest.fn(() => qr) } as unknown as DataSource,
    configService,
    mailService,
    { emit } as unknown as EventEmitter2,
    notificationsService,
    {} as unknown as ShippingService,
    {} as unknown as PathaoClientService,
  );
  return { service, productRepo, bidRepo, settlementRepo, emit };
}

describe('AuctionLifecycleService.releaseInstantBuyHold — after a failed payment (A54)', () => {
  const holdProduct = () =>
    makeProduct({
      status: ProductStatus.AWAITING_INSTANT_BUY,
      biddingEndsAt: new Date('2099-01-01T00:00:00Z'),
    });
  const holdBid = () =>
    makeBid({
      id: 'hold-bid',
      bidderId: 'buyer-1',
      amount: 1400,
      isInstantBuy: true,
      isCurrentlyPaymentResponsible: true,
      paymentStatus: BidPaymentStatus.PENDING,
      placedAt: new Date(Date.now() - 60_000),
    });

  it('retires the hold without counting an attempt and reopens bidding', async () => {
    const { service, productRepo, bidRepo, settlementRepo, emit } =
      buildHoldService({
        product: holdProduct(),
        holdBid: holdBid(),
        settlement: {
          id: 'round-ib',
          status: SettlementStatus.PENDING_PAYMENT,
        },
        paymentRows: 1,
        realHighestBid: makeBid(),
      });

    await service.releaseInstantBuyHold('product-1', 'round-ib');

    // The payment row FKs onto the settlement, so nothing is deleted…
    expect(bidRepo.delete).not.toHaveBeenCalled();
    expect(settlementRepo.delete).not.toHaveBeenCalled();
    // …and the bid is NOT_RESPONSIBLE, which the attempt cap (EXPIRED) ignores.
    expect(bidRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isCurrentlyPaymentResponsible: false,
        paymentStatus: BidPaymentStatus.NOT_RESPONSIBLE,
      }),
    );
    expect(settlementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SettlementStatus.EXPIRED }),
    );
    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ProductStatus.ACTIVE }),
    );
    expect(emit).toHaveBeenCalledWith(
      EventNames.AUCTION_RESUMED,
      expect.objectContaining({
        productId: 'product-1',
        failedBidderId: 'buyer-1',
        resumedStatus: 'ACTIVE',
      }),
    );
  });

  it('does nothing when the failed payment belonged to a different round', async () => {
    const { service, productRepo, bidRepo, emit } = buildHoldService({
      product: holdProduct(),
      holdBid: holdBid(),
      settlement: { id: 'round-newer' },
      paymentRows: 1,
    });

    await service.releaseInstantBuyHold('product-1', 'round-ib');

    expect(bidRepo.save).not.toHaveBeenCalled();
    expect(productRepo.save).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('still deletes the hold when no payment row exists (QR generation failed)', async () => {
    const { service, bidRepo, settlementRepo } = buildHoldService({
      product: holdProduct(),
      holdBid: holdBid(),
      settlement: { id: 'round-ib' },
      paymentRows: 0,
    });

    await service.releaseInstantBuyHold('product-1');

    expect(settlementRepo.delete).toHaveBeenCalledWith({ bidId: 'hold-bid' });
    expect(bidRepo.delete).toHaveBeenCalledWith({ id: 'hold-bid' });
  });
});

describe('AuctionLifecycleService.confirmPaymentGateway — a round that is over (A50, A55)', () => {
  it('rejects a payment for a lapsed Instant Buy hold (product ACTIVE again) as stale', async () => {
    const { service } = buildHoldService({
      product: makeProduct({ status: ProductStatus.ACTIVE }),
      holdBid: null,
      settlement: null,
      paymentRows: 0,
    });

    await expect(
      service.confirmPaymentGateway('product-1', 'round-ib', 120),
    ).rejects.toBeInstanceOf(StaleSettlementRoundException);
  });

  it('rejects a payment for a superseded fallback round as stale', async () => {
    const { service } = buildHoldService({
      product: makeProduct({ status: ProductStatus.AWAITING_PAYMENT }),
      holdBid: makeBid({
        id: 'rank-1-bid',
        isCurrentlyPaymentResponsible: true,
      }),
      settlement: { id: 'round-rank-1' },
      paymentRows: 0,
    });

    await expect(
      service.confirmPaymentGateway('product-1', 'round-rank-0', 120),
    ).rejects.toBeInstanceOf(StaleSettlementRoundException);
  });

  it('keeps "already SETTLED" a plain BadRequest, not a stale round', async () => {
    const { service } = buildHoldService({
      product: makeProduct({ status: ProductStatus.SETTLED }),
      holdBid: null,
      settlement: null,
      paymentRows: 0,
    });

    const err: unknown = await service
      .confirmPaymentGateway('product-1', 'round-1', 120)
      .catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(StaleSettlementRoundException);
    expect((err as Error).message).toContain('SETTLED');
  });
});

/*
 * Cash on delivery — the win settles when COD is chosen (payment COD_PENDING),
 * and a refused parcel unwinds the sale to ABANDONED with a buyer strike.
 */
function buildCodService(opts: {
  product: Product;
  bid?: Bid | null;
  payment?: Partial<ProductPayment> | null;
  delivery?: Partial<ProductDelivery> | null;
}) {
  const productRepo = {
    createQueryBuilder: jest.fn(() =>
      makeQueryBuilder({ getOne: opts.product }),
    ),
    save: jest.fn((p: Product) => p),
  };
  const bidRepo = {
    findOne: jest.fn().mockResolvedValue(opts.bid ?? null),
    save: jest.fn((b: Bid) => b),
    update: jest.fn(),
  };
  const settlementRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'round-1',
      bidId: 'bid-1',
      status: SettlementStatus.PENDING_PAYMENT,
    }),
    save: jest.fn((s: ProductSettlement) => s),
  };
  const updateQb: Record<string, jest.Mock> = {};
  for (const m of ['update', 'set', 'where', 'andWhere'])
    updateQb[m] = jest.fn(() => updateQb);
  updateQb.execute = jest.fn();
  const paymentRepo = {
    // generateManualReferenceLabel uniqueness probe — always free.
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((p: Partial<ProductPayment>) => ({ id: 'pay-cod', ...p })),
    save: jest.fn((p: ProductPayment) => p),
    createQueryBuilder: jest.fn(() => {
      const qb = makeQueryBuilder({ getOne: opts.payment ?? null });
      Object.assign(qb, {
        update: updateQb.update,
      });
      return qb;
    }),
  };
  const deliveryRepo = {
    findOne: jest.fn().mockResolvedValue(opts.delivery ?? null),
    save: jest.fn((d: ProductDelivery) => d),
  };
  const userRepo = { increment: jest.fn() };

  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn(() => updateQb),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Product) return productRepo;
        if (entity === Bid) return bidRepo;
        if (entity === ProductSettlement) return settlementRepo;
        if (entity === ProductPayment) return paymentRepo;
        if (entity === ProductDelivery) return deliveryRepo;
        if (entity === User) return userRepo;
        throw new Error('Unexpected repository requested in test');
      }),
    },
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => qr),
    getRepository: jest.fn(() => ({
      findOne: jest.fn().mockResolvedValue(null),
    })),
  } as unknown as DataSource;
  const emitter = { emit: jest.fn() };
  const notifications = { createForUser: jest.fn() };
  const shipping = {
    getOwned: jest
      .fn()
      .mockResolvedValue({ id: 'addr-1', pathaoCityId: 1, pathaoZoneId: 2 }),
  };
  const pathao = { isServiceable: jest.fn().mockReturnValue(true) };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'DELIVERY_CHARGE_FLAT') return 120;
      throw new Error(`Unexpected config key requested in test: ${key}`);
    }),
  };

  const service = new AuctionLifecycleService(
    dataSource,
    config as unknown as ConfigService,
    mailService,
    emitter as unknown as EventEmitter2,
    notifications as unknown as NotificationsService,
    shipping as unknown as ShippingService,
    pathao as unknown as PathaoClientService,
  );
  return {
    service,
    qr,
    productRepo,
    bidRepo,
    paymentRepo,
    deliveryRepo,
    userRepo,
    emitter,
  };
}

describe('AuctionLifecycleService.confirmCod', () => {
  const awaitingPayment = () =>
    makeProduct({ status: ProductStatus.AWAITING_PAYMENT });
  const winningBid = (overrides: Partial<Bid> = {}) =>
    makeBid({
      bidderId: 'buyer-1',
      amount: 1200,
      isCurrentlyPaymentResponsible: true,
      paymentStatus: BidPaymentStatus.PENDING,
      paymentDeadline: new Date(Date.now() + 3_600_000),
      ...overrides,
    });

  it('settles the sale with a COD_PENDING payment and hands off to delivery', async () => {
    const product = awaitingPayment();
    const bid = winningBid();
    const { service, qr, paymentRepo, emitter } = buildCodService({
      product,
      bid,
    });

    const { payment } = await service.confirmCod(
      'buyer-1',
      'product-1',
      'addr-1',
    );

    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(product.status).toBe(ProductStatus.SETTLED);
    expect(bid.paymentConfirmationMethod).toBe(PaymentConfirmationMethod.COD);
    expect(paymentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        method: PaymentMethod.COD,
        status: PaymentStatus.COD_PENDING,
        amount: 1200,
        deliveryCharge: 120,
        shippingAddressId: 'addr-1',
      }),
    );
    expect(payment.id).toBe('pay-cod');
    expect(emitter.emit).toHaveBeenCalledWith(
      EventNames.AUCTION_SETTLED,
      expect.objectContaining({ cashOnDelivery: true, buyerTotalAmount: 1320 }),
    );
    expect(emitter.emit).toHaveBeenCalledWith(
      EventNames.PAYMENT_COD_CONFIRMED,
      expect.objectContaining({
        paymentId: 'pay-cod',
        amount: 1200,
        deliveryCharge: 120,
      }),
    );
  });

  it('refuses an Instant Buy bid', async () => {
    const product = awaitingPayment();
    const { service, qr } = buildCodService({
      product,
      bid: winningBid({ isInstantBuy: true }),
    });

    await expect(
      service.confirmCod('buyer-1', 'product-1', 'addr-1'),
    ).rejects.toThrow('Instant Buy');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(product.status).toBe(ProductStatus.AWAITING_PAYMENT);
  });

  it('refuses an Instant Buy hold (product not AWAITING_PAYMENT)', async () => {
    const { service, qr } = buildCodService({
      product: makeProduct({ status: ProductStatus.AWAITING_INSTANT_BUY }),
      bid: winningBid({ isInstantBuy: true }),
    });

    await expect(
      service.confirmCod('buyer-1', 'product-1', 'addr-1'),
    ).rejects.toThrow('not awaiting payment');
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });

  it('refuses anyone but the responsible bidder', async () => {
    const { service, qr } = buildCodService({
      product: awaitingPayment(),
      bid: winningBid({ bidderId: 'someone-else' }),
    });

    await expect(
      service.confirmCod('buyer-1', 'product-1', 'addr-1'),
    ).rejects.toThrow('not the current winner');
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });
});

describe('AuctionLifecycleService.abandonAfterCodRefusal', () => {
  const codPayment = (overrides: Partial<ProductPayment> = {}) => ({
    id: 'pay-cod',
    productId: 'product-1',
    productSettlementId: 'round-1',
    winnerUserId: 'buyer-1',
    method: PaymentMethod.COD,
    status: PaymentStatus.COD_PENDING,
    ...overrides,
  });

  it('abandons the sale, marks the parcel returned and adds a buyer strike', async () => {
    const product = makeProduct({ status: ProductStatus.SETTLED });
    const delivery: Partial<ProductDelivery> = {
      id: 'delivery-1',
      deliveredAt: null,
      returnedAt: null,
    };
    const { service, qr, userRepo, bidRepo } = buildCodService({
      product,
      payment: codPayment(),
      delivery,
    });

    const payment = await service.abandonAfterCodRefusal('admin-1', 'pay-cod');

    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(payment.status).toBe(PaymentStatus.FAILED);
    expect(product.status).toBe(ProductStatus.ABANDONED);
    expect(product.settledAt).toBeNull();
    expect(delivery.returnedAt).toBeInstanceOf(Date);
    expect(delivery.returnedById).toBe('admin-1');
    expect(bidRepo.update).toHaveBeenCalledWith('bid-1', {
      paymentStatus: BidPaymentStatus.EXPIRED,
    });
    expect(userRepo.increment).toHaveBeenCalledWith(
      { id: 'buyer-1' },
      'codRefusalCount',
      1,
    );
  });

  it('refuses once Pathao has reported the parcel delivered', async () => {
    const product = makeProduct({ status: ProductStatus.SETTLED });
    const { service, qr, userRepo } = buildCodService({
      product,
      payment: codPayment(),
      delivery: { id: 'delivery-1', deliveredAt: new Date() },
    });

    await expect(
      service.abandonAfterCodRefusal('admin-1', 'pay-cod'),
    ).rejects.toThrow('delivered');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(product.status).toBe(ProductStatus.SETTLED);
    expect(userRepo.increment).not.toHaveBeenCalled();
  });

  it('refuses a prepaid payment', async () => {
    const { service, qr } = buildCodService({
      product: makeProduct({ status: ProductStatus.SETTLED }),
      payment: codPayment({
        method: PaymentMethod.FONEPAY,
        status: PaymentStatus.SUCCESS,
      }),
    });

    await expect(
      service.abandonAfterCodRefusal('admin-1', 'pay-cod'),
    ).rejects.toThrow('uncollected cash-on-delivery');
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });
});
