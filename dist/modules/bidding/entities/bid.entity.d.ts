import { BaseEntity } from "../../../common/entities/base.entity";
import { BidPaymentStatus } from "../../../common/enums/bid-payment-status.enum";
import { PaymentConfirmationMethod } from "../../../common/enums/payment-confirmation-method.enum";
import { Product } from "../../products/entities/product.entity";
import { User } from "../../users/entities/user.entity";
export declare class Bid extends BaseEntity {
    productId: string;
    product: Product;
    bidderId: string;
    bidder: User;
    amount: number;
    placedAt: Date;
    previousHighestAmount: number | null;
    wasFirstBid: boolean;
    isOriginalWinner: boolean;
    fallbackRank: number;
    isCurrentlyPaymentResponsible: boolean;
    paymentStatus: BidPaymentStatus;
    paymentDeadline: Date | null;
    paymentConfirmedAt: Date | null;
    paymentConfirmedById: string | null;
    paymentConfirmationMethod: PaymentConfirmationMethod | null;
    paymentWarningSentAt: Date | null;
}
