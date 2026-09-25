/**
 * Typed payloads for every domain event in EventNames.
 *
 * Handlers re-fetch current state to stay idempotent, so payloads carry the
 * minimum needed to identify the affected aggregate (productId) plus any IDs
 * or amounts that are already in scope at the emit point and cheap to pass —
 * never fields the handler does not consume.
 */

export interface BidSubmittedPayload {
  productId: string;
  bidId: string;
  bidderId: string;
  amount: number;
  // Added for NotificationsModule handlers — already in scope at the emit
  // site, cheap to pass, avoids the handler re-deriving prior bid state.
  productOwnerId: string;
  productTitle: string;
  wasFirstBid: boolean;
  biddingEndsAt: string; // ISO string
  previousHighestBidderId: string | null; // null on the very first bid
  previousBidAmount: number | null; // null on the very first bid
}

export interface AuctionClosedPayload {
  productId: string;
  winningBidId: string;
  winnerId: string;
  winningAmount: number;
  // Added for NotificationsModule handlers.
  sellerId: string;
  productTitle: string;
  paymentDeadline: string; // ISO string
}

export interface AuctionSettledPayload {
  productId: string;
  winningBidId: string;
  buyerId: string;
  // Item price only — what the seller-facing notification/email quotes.
  amount: number;
  // Item price + delivery charge — what the BUYER actually paid via the
  // bundled Fonepay QR (Rule 14). Kept separate from `amount` because the
  // seller never sees the delivery portion; conflating the two would quote
  // sellers an inflated "sale amount" that includes a logistics fee.
  buyerTotalAmount: number;
  // Added for NotificationsModule handlers.
  sellerId: string;
  productTitle: string;
}

// ─── Fonepay payment lifecycle ─────────────────────────────────────────────

export interface PaymentInitiatedPayload {
  productId: string;
  paymentId: string;
  referenceLabel: string;
  winnerUserId: string;
}

export interface PaymentSucceededPayload {
  productId: string;
  paymentId: string;
  referenceLabel: string;
  winnerUserId: string;
  fonepayTraceId: string | null;
  // Item price only (mirrors ProductPayment.amount).
  amount: number;
  // Bundled Rs. 120 delivery charge, snapshotted at initiation time — what
  // ProductDeliveriesService's PAYMENT_SUCCEEDED listener uses to populate
  // ProductDelivery.deliveryCharge without re-reading (possibly-changed)
  // config.
  deliveryCharge: number;
  // Which saved address to freeze onto ProductDelivery. Null is defensive
  // only — checkout requires this by the time a payment can succeed.
  shippingAddressId: string | null;
}

export interface PaymentFailedPayload {
  productId: string;
  paymentId: string;
  referenceLabel: string;
  winnerUserId: string;
  message: string;
}

export interface WinTransferredPayload {
  productId: string;
  fromUserId: string;
  toUserId: string;
  newPaymentDeadline: string;
  // Added for NotificationsModule handlers. newWinningBidId is the id of the
  // newly-promoted bid — used as the idempotency relatedId instead of
  // productId, since a single product can go through multiple fallback
  // rounds and productId alone would collide across rounds.
  sellerId: string;
  productTitle: string;
  winningAmount: number;
  fallbackRank: number;
  newWinningBidId: string;
}

// ─── Rewards (Rule 16) ──────────────────────────────────────────────────────

export interface SellerMarkedPaidPayload {
  paymentId: string;
  productId: string;
  sellerId: string;
  buyerId: string;
  pointsEarned: number;
  sellerPayoutAmount: number;
}
