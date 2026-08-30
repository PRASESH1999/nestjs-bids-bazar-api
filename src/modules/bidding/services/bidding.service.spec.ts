import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ProductStatus } from '@common/enums/product-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { MailService } from '@modules/mail/mail.service';
import { Bid } from '../entities/bid.entity';
import { PlaceBidDto } from '../dto/place-bid.dto';
import { BiddingService } from './bidding.service';

// Minimal fluent stub for TypeORM's SelectQueryBuilder — every chain method
// (where/andWhere/innerJoin/select/setLock/...) returns `this`; only the
// terminal method actually used by the call under test needs a resolved value.
function makeQueryBuilder(terminals: Record<string, unknown>) {
  const qb: Record<string, jest.Mock> = {
    setLock: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    innerJoin: jest.fn(),
    select: jest.fn(),
    orderBy: jest.fn(),
  };
  for (const key of Object.keys(qb)) {
    qb[key].mockReturnValue(qb);
  }
  for (const [method, value] of Object.entries(terminals)) {
    qb[method] = jest.fn().mockResolvedValue(value);
  }
  return qb;
}

type BidRepoStub = {
  createQueryBuilder: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

// The service issues two Bid query-builder queries in sequence per placeBid
// call when the bidder is new to the product: (1) getCount() to check for an
// existing bid on this product, (2) getRawOne() to count the user's other
// active-product slots. `existingBidCount === 0` skips query (2) entirely.
function makeBidRepo(opts: {
  existingBidCount: number;
  activeProductCount?: number;
}): BidRepoStub {
  let call = 0;
  return {
    createQueryBuilder: jest.fn(() => {
      call += 1;
      if (call === 1) {
        return makeQueryBuilder({ getCount: opts.existingBidCount });
      }
      return makeQueryBuilder({
        getRawOne: { count: String(opts.activeProductCount ?? 0) },
      });
    }),
    create: jest.fn((data: Partial<Bid>) => ({ ...data }) as Bid),
    save: jest.fn((bid: Bid) => ({ ...bid, id: 'new-bid-id' })),
  };
}

function makeProductRepo(product: Product) {
  return {
    createQueryBuilder: jest.fn(() => makeQueryBuilder({ getOne: product })),
    save: jest.fn((p: Product) => p),
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    ownerId: 'owner-1',
    status: ProductStatus.ACTIVE,
    currentHighestBid: 1000,
    currentHighestBidderId: 'other-bidder',
    biddingStartPrice: 900,
    biddingEndsAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Product;
}

describe('BiddingService.placeBid — max active bids per user', () => {
  const USER_ID = 'user-1';
  const dto: PlaceBidDto = { amount: 1020 };

  const configService = {
    getOrThrow: jest.fn((key: string) => {
      switch (key) {
        case 'BIDDING_DURATION_HOURS':
          return 72;
        case 'BID_INCREMENT_PERCENT':
          return 0.05;
        case 'BID_INCREMENT_MIN_FLAT':
          return 10;
        default:
          throw new Error(`Unexpected config key requested in test: ${key}`);
      }
    }),
  } as unknown as ConfigService;

  const mailService = {} as unknown as MailService;
  const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;

  function buildService(
    bidRepo: BidRepoStub,
    productRepo: ReturnType<typeof makeProductRepo>,
  ) {
    const qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn((entity: unknown) => {
          if (entity === Bid) return bidRepo;
          if (entity === Product) return productRepo;
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

    const service = new BiddingService(
      dataSource,
      configService,
      mailService,
      eventEmitter,
    );

    return { service, qr };
  }

  it('(a) rejects an 11th distinct product when the user already has 10 active bids', async () => {
    const bidRepo = makeBidRepo({
      existingBidCount: 0,
      activeProductCount: 10,
    });
    const productRepo = makeProductRepo(makeProduct());
    const { service, qr } = buildService(bidRepo, productRepo);

    await expect(service.placeBid(USER_ID, 'product-1', dto)).rejects.toThrow(
      new BadRequestException(
        'You can only have active bids on 10 products at a time. Wait for one to close before bidding on a new one.',
      ),
    );

    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
    expect(bidRepo.save).not.toHaveBeenCalled();
  });

  it('(b) lets the user raise a bid on a product they already hold a bid on, even at the 10-slot limit', async () => {
    // existingBidCount > 0 means the user already has a bid on THIS product,
    // so the slot-limit query never even runs — no new slot is consumed.
    const bidRepo = makeBidRepo({ existingBidCount: 1 });
    const productRepo = makeProductRepo(makeProduct());
    const { service, qr } = buildService(bidRepo, productRepo);

    const bid = await service.placeBid(USER_ID, 'product-1', dto);

    expect(bid).toBeDefined();
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    // The advisory lock + count query are skipped entirely for an existing slot.
    expect(qr.query).not.toHaveBeenCalled();
    expect(bidRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('(c) allows bidding on a new product once a prior one has closed and freed a slot', async () => {
    // One of the user's 10 products closed (no longer PENDING/ACTIVE), so the
    // active-status-filtered count comes back at 9, not 10.
    const bidRepo = makeBidRepo({ existingBidCount: 0, activeProductCount: 9 });
    const productRepo = makeProductRepo(makeProduct());
    const { service, qr } = buildService(bidRepo, productRepo);

    const bid = await service.placeBid(USER_ID, 'product-1', dto);

    expect(bid).toBeDefined();
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(qr.rollbackTransaction).not.toHaveBeenCalled();
    expect(qr.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [USER_ID],
    );
  });
});
