import { AuctionLifecycleService } from '../services/auction-lifecycle.service';
export declare class AuctionLifecycleCron {
    private readonly auctionLifecycleService;
    private readonly logger;
    constructor(auctionLifecycleService: AuctionLifecycleService);
    closeExpiredAuctions(): Promise<void>;
    expireOverduePayments(): Promise<void>;
    sendPaymentWindowWarnings(): Promise<void>;
}
