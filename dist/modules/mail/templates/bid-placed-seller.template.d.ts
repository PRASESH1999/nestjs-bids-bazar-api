export interface BidPlacedSellerTemplateParams {
    sellerName: string;
    productTitle: string;
    bidAmount: number | string;
    biddingEndsAt: Date;
    auctionUrl: string;
}
export declare function bidPlacedSellerTemplate(params: BidPlacedSellerTemplateParams): {
    subject: string;
    html: string;
};
