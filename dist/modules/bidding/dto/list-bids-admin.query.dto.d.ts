import { PaginationDto } from "../../../common/dto/pagination.dto";
import { BidPaymentStatus } from "../../../common/enums/bid-payment-status.enum";
export declare enum BidSortBy {
    AMOUNT = "amount",
    PLACED_AT = "placedAt",
    PAYMENT_STATUS = "paymentStatus"
}
export declare enum SortOrder {
    ASC = "ASC",
    DESC = "DESC"
}
export declare class ListBidsAdminQueryDto extends PaginationDto {
    productId?: string;
    bidderId?: string;
    paymentStatus?: BidPaymentStatus;
    sortBy?: BidSortBy;
    sortOrder?: SortOrder;
}
