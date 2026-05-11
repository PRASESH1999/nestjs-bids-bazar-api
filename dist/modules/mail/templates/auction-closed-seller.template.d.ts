export interface AuctionClosedSellerTemplateParams {
    sellerName: string;
    productTitle: string;
    winningAmount: number | string;
    winnerName: string;
}
export declare function auctionClosedSellerTemplate(params: AuctionClosedSellerTemplateParams): {
    subject: string;
    html: string;
};
