import Decimal from 'decimal.js';

// Rounds up to the nearest multiple of 5 — used for floor/minimum values
// (e.g. biddingStartPrice, the minimum next-bid amount) so a minimum is
// never accidentally weakened.
export function roundUpToMultipleOf5(value: Decimal.Value): number {
  return new Decimal(value).div(5).ceil().mul(5).toNumber();
}

// Rounds down to the nearest multiple of 5 — used for ceiling/maximum values
// (e.g. instantBuyPrice, biddingEndPrice, the maximum next-bid amount) so a
// ceiling is never accidentally exceeded.
export function roundDownToMultipleOf5(value: Decimal.Value): number {
  return new Decimal(value).div(5).floor().mul(5).toNumber();
}
