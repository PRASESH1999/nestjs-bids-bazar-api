import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ProductStatus } from '@common/enums/product-status.enum';
import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { MailService } from '@modules/mail/mail.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { Bid } from '../entities/bid.entity';
import { ProductSettlement } from '../entities/product-settlement.entity';
import { ShippingService } from '@modules/shipping/shipping.service';
import { PathaoClientService } from '@modules/pathao/services/pathao-client.service';
import { AuctionLifecycleService } from './auction-lifecycle.service';

// Same fluent-stub approach as bidding.service.spec.ts — every chain method
// returns `this`; only the terminal method actually used resolves a value.
function makeQueryBuilder(terminals: Record<string, unknown>) {
  const qb: Record<string, jest.Mock> = {
    setLock: jest.fn(),
    where: jest.fn(),
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
