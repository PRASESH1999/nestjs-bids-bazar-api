export interface PaymentConfirmedSellerTemplateParams {
    sellerName: string;
    productTitle: string;
    amount: number | string;
    buyerName: string;
}
export declare function paymentConfirmedSellerTemplate(params: PaymentConfirmedSellerTemplateParams): {
    subject: string;
    html: string;
};
