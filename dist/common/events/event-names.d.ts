export declare const EventNames: {
    readonly BID_SUBMITTED: "bid.submitted";
    readonly AUCTION_CLOSED: "auction.closed";
    readonly AUCTION_SETTLED: "auction.settled";
};
export type EventName = (typeof EventNames)[keyof typeof EventNames];
