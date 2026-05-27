import type { BidSubmittedPayload } from "../../../common/events/event-payloads.type";
import { AuctionBroadcastService } from '../services/auction-broadcast.service';
export declare class BidSubmittedHandler {
    private readonly auctionBroadcastService;
    private readonly logger;
    constructor(auctionBroadcastService: AuctionBroadcastService);
    handle(payload: BidSubmittedPayload): Promise<void>;
}
