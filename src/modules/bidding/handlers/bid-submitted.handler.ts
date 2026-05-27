import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type { BidSubmittedPayload } from '@common/events/event-payloads.type';
import { AuctionBroadcastService } from '../services/auction-broadcast.service';

/**
 * Thin orchestrator: re-broadcasts the current auction state for the affected
 * product so any connected SSE subscribers see the new bid immediately.
 *
 * Idempotency note: broadcasting pushes current state — replays simply re-send
 * the same snapshot, so no explicit state-guard applies here.
 */
@Injectable()
export class BidSubmittedHandler {
  private readonly logger = new Logger(BidSubmittedHandler.name);

  constructor(
    private readonly auctionBroadcastService: AuctionBroadcastService,
  ) {}

  @OnEvent(EventNames.BID_SUBMITTED, { async: true })
  async handle(payload: BidSubmittedPayload): Promise<void> {
    const jobId = uuidv4();
    const startTime = Date.now();

    this.logger.log('Handling bid.submitted event', {
      jobId,
      productId: payload.productId,
      bidId: payload.bidId,
    });

    try {
      await this.auctionBroadcastService.broadcastUpdate(payload.productId);

      this.logger.log('bid.submitted handled', {
        jobId,
        productId: payload.productId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('Failed to handle bid.submitted', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
