export interface BidSubmittedPayload {
    productId: string;
    bidId: string;
    bidderId: string;
    amount: number;
}
export interface AuctionClosedPayload {
    productId: string;
    winningBidId: string;
    winnerId: string;
    winningAmount: number;
}
export interface AuctionSettledPayload {
    productId: string;
    winningBidId: string;
    buyerId: string;
    amount: number;
}
