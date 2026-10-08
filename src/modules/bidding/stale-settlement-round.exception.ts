import { BadRequestException } from '@nestjs/common';

/**
 * A gateway confirmation arrived for a settlement round that is no longer the
 * live one: the win cascaded to another bidder (A50), the Instant Buy hold
 * lapsed and bidding reopened (A55), or the lot was abandoned.
 *
 * Thrown by AuctionLifecycleService.confirmPaymentGateway. Its own type —
 * rather than a message to string-match — because the caller has to act on it:
 * the buyer's money moved and nothing was settled, so PaymentsService flags
 * the payment for a refund instead of only logging it.
 *
 * "Already SETTLED" is deliberately NOT this exception; it is benign when the
 * same payment did the settling, and PaymentsService tells the two apart.
 */
export class StaleSettlementRoundException extends BadRequestException {}
