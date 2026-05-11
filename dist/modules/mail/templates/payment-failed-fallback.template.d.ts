export interface PaymentFailedFallbackTemplateParams {
    bidderName: string;
    productTitle: string;
    winningAmount: number | string;
    paymentDeadline: Date;
    fallbackRank: number;
    paymentUrl: string;
}
export declare function paymentFailedFallbackTemplate(params: PaymentFailedFallbackTemplateParams): {
    subject: string;
    html: string;
};
