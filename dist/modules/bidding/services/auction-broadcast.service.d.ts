import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
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
    topBidders: Array<{
        username: string;
        highestBid: number;
    }>;
    recentBids: RecentBidItem[];
}
export declare class AuctionBroadcastService {
    private readonly dataSource;
    private readonly biddingService;
    private readonly logger;
    private readonly subject;
    constructor(dataSource: DataSource, biddingService: BiddingService);
    streamFor(productId: string): Observable<MessageEvent>;
    buildPayload(productId: string): Promise<AuctionUpdatePayload>;
    broadcastUpdate(productId: string): Promise<void>;
    private fetchRecentBids;
}
