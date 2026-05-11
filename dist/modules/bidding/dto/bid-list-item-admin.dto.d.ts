import { BidPaymentStatus } from "../../../common/enums/bid-payment-status.enum";
export declare class BidListItemAdminDto {
    id: string;
    amount: number;
    placedAt: string;
    bidderId: string;
    bidderName: string;
    bidderEmail: string;
    paymentStatus: BidPaymentStatus;
    paymentDeadline: string | null;
    isOriginalWinner: boolean;
    fallbackRank: number;
    isCurrentlyPaymentResponsible: boolean;
}
