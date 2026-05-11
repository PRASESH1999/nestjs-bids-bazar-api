export interface PaymentWindowExpiringTemplateParams {
    bidderName: string;
    productTitle: string;
    amount: number | string;
    paymentDeadline: Date;
    paymentUrl: string;
}
export declare function paymentWindowExpiringTemplate(params: PaymentWindowExpiringTemplateParams): {
    subject: string;
    html: string;
};
