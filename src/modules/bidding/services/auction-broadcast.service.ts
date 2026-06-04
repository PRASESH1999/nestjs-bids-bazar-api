import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable, Subject, filter, map } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { Product } from '@modules/products/entities/product.entity';
import { Bid } from '../entities/bid.entity';
import { BiddingService } from './bidding.service';

export interface RecentBidItem {
  username: string;
  amount: number;
  placedAt: string;
}

export interface AuctionUpdatePayload {
  type: 'auction.update';
  productId: string;
  status: string;
  currentHighestBid: number | null;
  currentHighestBidderId: string | null;
  biddingEndsAt: string | null;
  topBidders: Array<{ username: string; highestBid: number }>;
  recentBids: RecentBidItem[];
}

interface SubjectMessage {
  productId: string;
  payload: AuctionUpdatePayload;
}

/**
 * Per-product live-update broadcaster for the product detail page.
 *
 * Internally holds a single in-memory RxJS Subject keyed by productId at the
 * payload level. This is acceptable for the single-instance pilot only —
 * scaling to multiple Node instances requires swapping this Subject for a
 * pub/sub adapter (e.g. Redis) so events emitted on one instance reach SSE
 * subscribers on another. See Rule 7 for the chosen real-time architecture.
 */
@Injectable()
export class AuctionBroadcastService {
  private readonly logger = new Logger(AuctionBroadcastService.name);

  private readonly subject = new Subject<SubjectMessage>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly biddingService: BiddingService,
  ) {}

  /**
   * Returns the per-product SSE stream. Each emitted value is shaped as a
   * NestJS MessageEvent so the controller can return it directly from an
   * @Sse() route.
   */
  streamFor(productId: string): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      filter((msg) => msg.productId === productId),
      map((msg): MessageEvent => ({ data: msg.payload })),
    );
  }

  /**
   * Builds the full live-view payload for a product. Combines top-bidders
   * (leaderboard) and recent-bids (battle feed) into a single envelope so the
   * frontend can toggle views from one event.
   *
   * Throws NotFoundException if the product does not exist — callers are
   * expected to have already validated public visibility before this point.
   */
  async buildPayload(productId: string): Promise<AuctionUpdatePayload> {
    const product = await this.dataSource
      .getRepository(Product)
      .findOne({ where: { id: productId } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Reuse the existing query — single source of truth for top bidders.
    const topBidders =
      await this.biddingService.getTopBiddersForProduct(productId);

    const recentBids = await this.fetchRecentBids(productId);

    return {
      type: 'auction.update',
      productId: product.id,
      status: product.status,
      currentHighestBid:
        product.currentHighestBid !== null
          ? Number(product.currentHighestBid)
          : null,
      currentHighestBidderId: product.currentHighestBidderId,
      biddingEndsAt: product.biddingEndsAt
        ? product.biddingEndsAt.toISOString()
        : null,
      topBidders,
      recentBids,
    };
  }

  /**
   * Pushes a freshly-built payload to all subscribers of this product's stream.
   * Safe to call repeatedly — broadcasting just propagates current state, so
   * no idempotency guard is needed at this layer.
   */
  async broadcastUpdate(productId: string): Promise<void> {
    const payload = await this.buildPayload(productId);
    this.subject.next({ productId, payload });
    this.logger.debug(
      `broadcastUpdate: pushed update for product ${productId}`,
    );
  }

  /**
   * Last 5 bids for the battle feed, ordered newest-first. Repeats of the
   * same bidder are expected — this is a chronological feed, not a leaderboard.
   *
   * Bidder identity is the public-facing User.username — name is private and
   * never exposed to other users.
   */
  private async fetchRecentBids(productId: string): Promise<RecentBidItem[]> {
    const rows = await this.dataSource
      .getRepository(Bid)
      .createQueryBuilder('bid')
      .innerJoin('bid.bidder', 'bidder')
      .select('bidder.username', 'username')
      .addSelect('bid.amount', 'amount')
      .addSelect('bid.placedAt', 'placedAt')
      .where('bid.productId = :productId', { productId })
      .orderBy('bid.placedAt', 'DESC')
      .limit(5)
      .getRawMany<{ username: string; amount: string; placedAt: Date }>();

    return rows.map((row) => ({
      username: row.username,
      amount: Number(row.amount),
      placedAt: new Date(row.placedAt).toISOString(),
    }));
  }
}
