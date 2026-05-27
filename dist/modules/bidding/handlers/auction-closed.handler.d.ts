import type { AuctionClosedPayload } from "../../../common/events/event-payloads.type";
import { AuctionBroadcastService } from '../services/auction-broadcast.service';
export declare class AuctionClosedHandler {
    private readonly auctionBroadcastService;
    private readonly logger;
    constructor(auctionBroadcastService: AuctionBroadcastService);
    handle(payload: AuctionClosedPayload): Promise<void>;
}
