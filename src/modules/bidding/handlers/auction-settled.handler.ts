import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type { AuctionSettledPayload } from '@common/events/event-payloads.type';
import { AuctionBroadcastService } from '../services/auction-broadcast.service';

/**
 * Thin orchestrator: re-broadcasts the post-settlement auction state so
 * subscribers see the SETTLED transition immediately.
 *
 * Idempotency note: broadcasting pushes current state — replays simply re-send
 * the same snapshot, so no explicit state-guard applies here.
 */
@Injectable()
export class AuctionSettledHandler {
  private readonly logger = new Logger(AuctionSettledHandler.name);

  constructor(
    private readonly auctionBroadcastService: AuctionBroadcastService,
  ) {}

  @OnEvent(EventNames.AUCTION_SETTLED, { async: true })
  async handle(payload: AuctionSettledPayload): Promise<void> {
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.log('Handling auction.settled event', {
      jobId,
      productId: payload.productId,
      winningBidId: payload.winningBidId,
    });

    try {
      await this.auctionBroadcastService.broadcastUpdate(payload.productId);

      this.logger.log('auction.settled handled', {
        jobId,
        productId: payload.productId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('Failed to handle auction.settled', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
