export interface AuctionWonTemplateParams {
    bidderName: string;
    productTitle: string;
    winningAmount: number | string;
    paymentDeadline: Date;
    paymentUrl: string;
}
export declare function auctionWonTemplate(params: AuctionWonTemplateParams): {
    subject: string;
    html: string;
};
