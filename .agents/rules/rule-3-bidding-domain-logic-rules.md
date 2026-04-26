---
trigger: always_on
---

# Rule 3: Bidding Domain Logic Rules

## Auction Model
- English auction only — highest bid at close wins.
- Every auction has one winner — the bidder with the highest valid bid when the auction closes.
- In case of a tie (same amount placed simultaneously), the earliest timestamp wins.

## Bid Lifecycle — State Machine
A bid must always move forward through these states. No backward transitions allowed.

DRAFT → SUBMITTED → ACCEPTED | REJECTED

- DRAFT      : Bid created but not yet submitted (optional pre-submission state)
- SUBMITTED  : Bid placed by bidder, pending validation
- ACCEPTED   : Bid passed all validation rules and is the current leading bid
- REJECTED   : Bid failed validation (below minimum, increment violation, closed auction, etc.)

A bid in ACCEPTED or REJECTED state is immutable — it can never be edited or deleted.

## Auction Lifecycle — State Machine
PENDING → ACTIVE → CLOSED → AWAITING_PAYMENT → SETTLED | PAYMENT_FAILED | ABANDONED

- PENDING         : Auction created, no bids placed yet
- ACTIVE          : First bid placed — countdown timer starts from this moment
- CLOSED          : Timer expired — no more bids accepted, ranked fallback list locked
- AWAITING_PAYMENT: Current winner notified, 18hr payment window started
- SETTLED         : Payment confirmed, winner finalized, auction complete
- PAYMENT_FAILED  : Payment window expired or payment rejected — fallback triggered
- ABANDONED       : All bidders in fallback chain exhausted payment window

## Auction Closing Rule
- Auction closes exactly X hours after the first bid is placed.
- X is defined per auction at creation time and stored as closesAt (ISO timestamp).
- closesAt = firstBidPlacedAt + X hours (set when auction transitions PENDING → ACTIVE).
- [DECISION NEEDED]: Define the value or allowed range of X (e.g. fixed 24hrs, or
  configurable per auction between 1–72hrs).
- Once closesAt is set it is immutable — no extensions allowed unless explicitly designed.

## Bid Increment Rules
- [DECISION NEEDED]: Choose one of the following and remove the others:
  Option A — Fixed increment: New bid must be at least (currentHighestBid + MIN_INCREMENT).
             Define MIN_INCREMENT as a config value (e.g. MIN_BID_INCREMENT=10).
  Option B — Percentage increment: New bid must be at least
             (currentHighestBid * (1 + MIN_INCREMENT_PERCENT)).
             Define MIN_INCREMENT_PERCENT as a config value (e.g. 0.05 for 5%).
  Option C — No increment rule: Any bid strictly greater than currentHighestBid is valid.
- Until decided, enforce Option C as the default (any amount strictly above current high bid).

## Bid Validation Rules (enforce in BidsService before persisting)
A bid must be rejected if ANY of the following are true:
- Auction status is not ACTIVE
- Current time is past closesAt
- Bid amount is less than or equal to the current highest bid
- Bid amount is below the auction's startingPrice
- Bidder is the auction owner (cannot bid on your own auction)
- Bidder already holds the current highest bid (cannot outbid yourself)
- Bid amount is not a positive number
- [DECISION NEEDED]: Currency/decimal precision rules (e.g. max 2 decimal places)

## Immutability Rules
- Bids cannot be edited or deleted once SUBMITTED.
- Auction startingPrice, currency, and closesAt cannot be changed once auction is ACTIVE.
- The winning bid record must never be mutated after auction is SETTLED.
- The ranked fallback list is immutable once auction is CLOSED.
- paymentDeadline is reset each time a new winner is assigned — but the 18hr window
  is fixed and cannot be extended.

## Winner Fallback & Payment Enforcement
- After auction CLOSED, the winning bidder has exactly 18 hours to complete payment.
- This deadline is stored as paymentDeadline = closedAt + 18 hours on the auction record.

### Bid Priority Order
- All ACCEPTED bids are ranked by amount (descending), with timestamp (ascending) as tiebreaker.
- This ranked list is preserved after CLOSED — it is the fallback chain.

### Fallback Rules
- If payment is not confirmed within 18hrs, auction moves to PAYMENT_FAILED.
- System automatically moves to the next highest bidder and restarts an AWAITING_PAYMENT
  window for them — same 18hr window.
- This cascades down the ranked bid list until either:
    a) A bidder completes payment → auction moves to SETTLED
    b) All bidders exhaust the payment window → auction moves to ABANDONED
- A bidder who fails payment is marked as PAYMENT_DEFAULTED on that bid record.
- [DECISION NEEDED]: Should PAYMENT_DEFAULTED bidders face any penalty?
  (e.g. temporary ban, strike system, account flag)
- [DECISION NEEDED]: Define ABANDONED state handling — notify auction owner?
  relist the auction? manual intervention required?

## Business Logic Placement
- All bid validation logic lives exclusively in BidsService — never in controller or repository.
- Auction state transition logic lives exclusively in AuctionsService.
- No domain rules in DTOs — DTOs handle shape and format validation only.
- Use custom exception classes for domain violations, e.g.:
    BidBelowMinimumException
    AuctionClosedException
    SelfBiddingException
    DuplicateLeadingBidException
    PaymentWindowExpiredException
    NoRemainingBiddersException

## Constants & Configuration
- Never hardcode domain values — define in config/:
    MIN_BID_INCREMENT         (if using fixed increment)
    MIN_INCREMENT_PERCENT     (if using percentage increment)
    AUCTION_DURATION_HOURS    (default X if not specified per auction)
    PAYMENT_WINDOW_HOURS      (fixed at 18 — do not change without a rule update)
- Access all config values through NestJS ConfigService only.