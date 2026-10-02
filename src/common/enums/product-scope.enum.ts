/**
 * A named slice of the public product statuses.
 *
 * `GET /products` deliberately refuses a `status` filter — the scope there is
 * everybody's listings, so letting a caller name a status is a way to ask for
 * other people's DRAFT and REJECTED rows. But "what is this seller selling
 * now" and "what have they sold" are both reasonable public questions, and
 * neither can be asked without narrowing the status somehow.
 *
 * A scope answers them without opening the general filter: each value maps to a
 * fixed set of *already public* statuses, chosen here rather than by the
 * caller. See OPEN-ITEMS A33.
 */
export enum ProductScope {
  /** Open for bidding — with bids (ACTIVE) or still waiting for the first. */
  LIVE = 'live',
  /** Sold and paid for. */
  SOLD = 'sold',
}
