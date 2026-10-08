import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { DataSource } from 'typeorm';
import type { MailService } from '@modules/mail/mail.service';
import type { RatingsService } from '@modules/ratings/ratings.service';
import { Product } from '@modules/products/entities/product.entity';
import { PUBLIC_BID_CONDITION } from '../bid-visibility';
import { BiddingService } from './bidding.service';

/*
 * A53 — an unpaid Instant Buy hold bid must not reach any public bid view or
 * count, while admin views keep it. These pin that every public read applies
 * PUBLIC_BID_CONDITION (and joins the product it refers to), and the admin
 * read does not.
 */

function recordingQueryBuilder(terminals: Record<string, unknown>) {
  const qb: Record<string, jest.Mock> = {};
  const chain = [
    'leftJoinAndSelect',
    'innerJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'limit',
    'setParameter',
  ];
  for (const method of chain) qb[method] = jest.fn(() => qb);
  for (const [method, value] of Object.entries(terminals)) {
    qb[method] = jest.fn().mockResolvedValue(value);
  }
  return qb;
}

function buildService(qb: ReturnType<typeof recordingQueryBuilder>) {
  const dataSource = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Product
        ? { findOne: jest.fn().mockResolvedValue({ id: 'product-1' }) }
        : { createQueryBuilder: jest.fn(() => qb) },
    ),
  } as unknown as DataSource;

  return new BiddingService(
    dataSource,
    {} as ConfigService,
    {} as MailService,
    {} as EventEmitter2,
    {} as RatingsService,
  );
}

function expectPublicFilter(qb: ReturnType<typeof recordingQueryBuilder>) {
  expect(qb.innerJoin).toHaveBeenCalledWith('bid.product', 'product');
  expect(qb.andWhere).toHaveBeenCalledWith(PUBLIC_BID_CONDITION);
}

describe('Public bid views exclude unpaid Instant Buy hold bids (A53)', () => {
  it('only lets the hold bid through once it is the winning bid', () => {
    expect(PUBLIC_BID_CONDITION).toBe(
      '(bid.isInstantBuy = false OR bid.id = product.winningBidId)',
    );
  });

  it('getTopBiddersForProduct filters the hold bid out of the leaderboard', async () => {
    const qb = recordingQueryBuilder({ getRawMany: [] });
    await buildService(qb).getTopBiddersForProduct('product-1');
    expectPublicFilter(qb);
  });

  it('getBidCountsForProduct does not count the hold bid', async () => {
    const qb = recordingQueryBuilder({
      getRawOne: { total: '0', today: '0' },
    });
    await buildService(qb).getBidCountsForProduct('product-1');
    expectPublicFilter(qb);
  });

  it('getBidsForProduct filters it for an ordinary viewer', async () => {
    const qb = recordingQueryBuilder({ getMany: [] });
    await buildService(qb).getBidsForProduct('product-1', 'authenticated');
    expect(qb.andWhere).toHaveBeenCalledWith(PUBLIC_BID_CONDITION);
  });

  it('getBidsForProduct keeps it for an admin', async () => {
    const qb = recordingQueryBuilder({ getMany: [] });
    await buildService(qb).getBidsForProduct('product-1', 'admin');
    expect(qb.andWhere).not.toHaveBeenCalledWith(PUBLIC_BID_CONDITION);
  });
});
