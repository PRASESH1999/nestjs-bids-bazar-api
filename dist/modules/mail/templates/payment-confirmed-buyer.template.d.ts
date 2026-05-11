export interface PaymentConfirmedBuyerTemplateParams {
    buyerName: string;
    productTitle: string;
    amount: number | string;
}
export declare function paymentConfirmedBuyerTemplate(params: PaymentConfirmedBuyerTemplateParams): {
    subject: string;
    html: string;
};
