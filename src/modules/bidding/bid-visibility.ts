/**
 * Which bids the public may see and count.
 *
 * An Instant Buy hold writes a synthetic bid at `instantBuyPrice` the moment a
 * buyer starts paying (see AuctionLifecycleService.startInstantBuyHold). That
 * row is a payment hold, not a bid anyone placed in the auction: until the
 * payment confirms it must not appear in the leaderboard, the battle feed, the
 * bid list or any bid count — otherwise, during a hold and forever after a
 * failed one, the would-be buyer is shown leading at a price above the real
 * `currentHighestBid`. See OPEN-ITEMS A53.
 *
 * Once the payment confirms, the hold bid becomes the product's
 * `winningBidId` and is a real sale, so it is shown from then on.
 *
 * Admin views deliberately skip this filter — they show the hold bid flagged
 * with `isInstantBuy`.
 *
 * Usage: the query must alias the bid as `bid` and the product as `product`
 * (join it in when querying from `Bid`).
 */
export const PUBLIC_BID_CONDITION =
  '(bid.isInstantBuy = false OR bid.id = product.winningBidId)';
