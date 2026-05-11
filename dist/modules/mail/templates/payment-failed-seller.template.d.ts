export interface PaymentFailedSellerTemplateParams {
    sellerName: string;
    productTitle: string;
    failedBidderRank: number;
    newWinnerName: string;
    newWinnerBidAmount: number | string;
}
export declare function paymentFailedSellerTemplate(params: PaymentFailedSellerTemplateParams): {
    subject: string;
    html: string;
};
