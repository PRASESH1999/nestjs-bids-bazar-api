export enum ProductStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  SETTLED = 'SETTLED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  ABANDONED = 'ABANDONED',
  WITHDRAWN = 'WITHDRAWN',
}

export const PUBLICLY_VISIBLE_STATUSES: ProductStatus[] = [
  ProductStatus.PENDING,
  ProductStatus.ACTIVE,
  ProductStatus.CLOSED,
  ProductStatus.AWAITING_PAYMENT,
  ProductStatus.SETTLED,
];

export const OWNER_EDITABLE_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.REJECTED,
];

// Still a live, biddable listing: publicly listed awaiting its first bid
// (PENDING) or currently accepting bids (ACTIVE). Once a product leaves this
// set (CLOSED and beyond, WITHDRAWN, etc.) it no longer counts as "active"
// for views like the favorites list.
export const ACTIVE_LISTING_STATUSES: ProductStatus[] = [
  ProductStatus.PENDING,
  ProductStatus.ACTIVE,
];

// Statuses a product can be in without ever having actually gone live for
// public sale. Everything else means it was approved and listed at some
// point, even if it has since closed, failed payment, or been abandoned —
// used to compute a seller's total listings count.
export const NEVER_LISTED_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.SUBMITTED,
  ProductStatus.REJECTED,
  ProductStatus.APPROVED,
  ProductStatus.WITHDRAWN,
];
