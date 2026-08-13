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
  amount: number;
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
