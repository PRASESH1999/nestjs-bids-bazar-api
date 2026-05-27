import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type { AuctionClosedPayload } from '@common/events/event-payloads.type';
import { AuctionBroadcastService } from '../services/auction-broadcast.service';

/**
 * Thin orchestrator: re-broadcasts the post-close auction state so subscribers
 * pick up the AWAITING_PAYMENT transition and winning-bid context.
 *
 * Idempotency note: broadcasting pushes current state — replays simply re-send
 * the same snapshot, so no explicit state-guard applies here.
 */
@Injectable()
export class AuctionClosedHandler {
  private readonly logger = new Logger(AuctionClosedHandler.name);

  constructor(
    private readonly auctionBroadcastService: AuctionBroadcastService,
  ) {}

  @OnEvent(EventNames.AUCTION_CLOSED, { async: true })
  async handle(payload: AuctionClosedPayload): Promise<void> {
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.log('Handling auction.closed event', {
      jobId,
      productId: payload.productId,
      winningBidId: payload.winningBidId,
    });

    try {
      await this.auctionBroadcastService.broadcastUpdate(payload.productId);

      this.logger.log('auction.closed handled', {
        jobId,
        productId: payload.productId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('Failed to handle auction.closed', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
