export interface BidOutbidTemplateParams {
    bidderName: string;
    productTitle: string;
    yourBidAmount: number | string;
    newHighestBid: number | string;
    biddingEndsAt: Date;
    auctionUrl: string;
}
export declare function bidOutbidTemplate(params: BidOutbidTemplateParams): {
    subject: string;
    html: string;
};
