import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { EventNames } from '@common/events/event-names';
import type {
  AuctionPausedPayload,
  AuctionResumedPayload,
} from '@common/events/event-payloads.type';
import { AuctionBroadcastService } from '../services/auction-broadcast.service';

/**
 * Thin orchestrator: re-broadcasts current auction state when an Instant Buy
 * hold starts or releases, so SSE subscribers pick up the
 * AWAITING_INSTANT_BUY pause/resume immediately. Mirrors AuctionClosedHandler.
 *
 * Idempotency note: broadcasting pushes current state — replays simply re-send
 * the same snapshot, so no explicit state-guard applies here.
 */
@Injectable()
export class InstantBuyHoldHandler {
  private readonly logger = new Logger(InstantBuyHoldHandler.name);

  constructor(
    private readonly auctionBroadcastService: AuctionBroadcastService,
  ) {}

  @OnEvent(EventNames.AUCTION_PAUSED, { async: true })
  async handlePaused(payload: AuctionPausedPayload): Promise<void> {
    const jobId = uuidv4();

    this.logger.log('Handling auction.paused event', {
      jobId,
      productId: payload.productId,
      bidId: payload.bidId,
    });

    try {
      await this.auctionBroadcastService.broadcastUpdate(payload.productId);
    } catch (error) {
      this.logger.error('Failed to handle auction.paused', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  @OnEvent(EventNames.AUCTION_RESUMED, { async: true })
  async handleResumed(payload: AuctionResumedPayload): Promise<void> {
    const jobId = uuidv4();

    this.logger.log('Handling auction.resumed event', {
      jobId,
      productId: payload.productId,
      resumedStatus: payload.resumedStatus,
    });

    try {
      await this.auctionBroadcastService.broadcastUpdate(payload.productId);
    } catch (error) {
      this.logger.error('Failed to handle auction.resumed', {
        jobId,
        productId: payload.productId,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }
}
