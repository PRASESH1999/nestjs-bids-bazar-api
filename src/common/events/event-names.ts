/**
 * Single source of truth for domain event names.
 *
 * Per Rule 7: dot.notation, lowercase, past-tense. Never hardcode raw event
 * strings anywhere in the codebase — always import from here.
 *
 * Only the events listed below are emitted today. Planned events for the rest
 * of the auction lifecycle (auction.activated, auction.abandoned,
 * payment.window.started, payment.window.expired, payment.confirmed) live in
 * Rule 7 and will be added here when the corresponding service emit points
 * are wired in.
 */
export const EventNames = {
  BID_SUBMITTED: 'bid.submitted',
  AUCTION_CLOSED: 'auction.closed',
  AUCTION_SETTLED: 'auction.settled',

  // Fonepay payment lifecycle
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  WIN_TRANSFERRED: 'win.transferred',

  // Rewards (Rule 16) — fired once per sale, when an admin flags the seller
  // as paid. The sole points/commission trigger.
  SELLER_MARKED_PAID: 'seller.marked_paid',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
