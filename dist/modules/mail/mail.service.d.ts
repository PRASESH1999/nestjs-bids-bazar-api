import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class MailService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private transporter;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    sendVerificationEmail(to: string, rawToken: string): Promise<void>;
    sendKycReceived(to: string, name: string): Promise<void>;
    sendKycApproved(to: string, name: string): Promise<void>;
    sendKycRejected(to: string, name: string, reason: string): Promise<void>;
    sendProductSubmitted(to: string, name: string, productTitle: string): Promise<void>;
    sendProductApproved(to: string, name: string, productTitle: string): Promise<void>;
    sendProductRejected(to: string, name: string, productTitle: string, reason: string): Promise<void>;
    sendBidPlacedSeller(to: string, params: {
        sellerName: string;
        productTitle: string;
        bidAmount: number | string;
        biddingEndsAt: Date;
        productId: string;
    }): Promise<void>;
    sendBidOutbid(to: string, params: {
        bidderName: string;
        productTitle: string;
        yourBidAmount: number | string;
        newHighestBid: number | string;
        biddingEndsAt: Date;
        productId: string;
    }): Promise<void>;
    sendAuctionWon(to: string, params: {
        bidderName: string;
        productTitle: string;
        productId: string;
        winningAmount: number | string;
        paymentDeadline: Date;
    }): Promise<void>;
    sendAuctionClosedSeller(to: string, params: {
        sellerName: string;
        productTitle: string;
        winningAmount: number | string;
        winnerName: string;
    }): Promise<void>;
    sendPaymentWindowExpiring(to: string, params: {
        bidderName: string;
        productTitle: string;
        amount: number | string;
        paymentDeadline: Date;
        productId: string;
    }): Promise<boolean>;
    sendPaymentFailedFallback(to: string, params: {
        bidderName: string;
        productTitle: string;
        productId: string;
        winningAmount: number | string;
        paymentDeadline: Date;
        fallbackRank: number;
    }): Promise<void>;
    sendPaymentFailedSeller(to: string, params: {
        sellerName: string;
        productTitle: string;
        failedBidderRank: number;
        newWinnerName: string;
        newWinnerBidAmount: number | string;
    }): Promise<void>;
    sendPaymentConfirmedSeller(to: string, params: {
        sellerName: string;
        productTitle: string;
        amount: number | string;
        buyerName: string;
    }): Promise<void>;
    sendPaymentConfirmedBuyer(to: string, params: {
        buyerName: string;
        productTitle: string;
        amount: number | string;
    }): Promise<void>;
    sendAuctionAbandoned(to: string, params: {
        sellerName: string;
        productTitle: string;
        totalBidders: number;
    }): Promise<void>;
    private send;
    private trySend;
}
