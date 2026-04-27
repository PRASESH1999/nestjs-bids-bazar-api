export declare enum ReviewAction {
    APPROVE = "APPROVE",
    REJECT = "REJECT"
}
export declare class ReviewKycDto {
    action: ReviewAction;
    rejectionReason?: string;
}
