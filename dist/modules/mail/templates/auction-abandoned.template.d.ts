export interface AuctionAbandonedTemplateParams {
    sellerName: string;
    productTitle: string;
    totalBidders: number;
}
export declare function auctionAbandonedTemplate(params: AuctionAbandonedTemplateParams): {
    subject: string;
    html: string;
};
