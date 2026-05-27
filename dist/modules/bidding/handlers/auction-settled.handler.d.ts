import type { AuctionSettledPayload } from "../../../common/events/event-payloads.type";
import { AuctionBroadcastService } from '../services/auction-broadcast.service';
export declare class AuctionSettledHandler {
    private readonly auctionBroadcastService;
    private readonly logger;
    constructor(auctionBroadcastService: AuctionBroadcastService);
    handle(payload: AuctionSettledPayload): Promise<void>;
}
