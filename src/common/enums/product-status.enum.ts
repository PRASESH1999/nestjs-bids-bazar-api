export enum ProductStatus {
  DRAFT = 'DRAFT',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  REJECTED = 'REJECTED',
  AWAITING_FIRST_BID = 'AWAITING_FIRST_BID',
  ACTIVE = 'ACTIVE',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  SETTLED = 'SETTLED',
  ABANDONED = 'ABANDONED',
  WITHDRAWN = 'WITHDRAWN',
}

export const PUBLICLY_VISIBLE_STATUSES: ProductStatus[] = [
  ProductStatus.AWAITING_FIRST_BID,
  ProductStatus.ACTIVE,
  ProductStatus.AWAITING_PAYMENT,
  ProductStatus.SETTLED,
];

export const OWNER_EDITABLE_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.REJECTED,
];

// Still a live, biddable listing: publicly listed awaiting its first bid
// (AWAITING_FIRST_BID) or currently accepting bids (ACTIVE). Once a product
// leaves this set (AWAITING_PAYMENT and beyond, WITHDRAWN, etc.) it no longer
// counts as "active" for views like the favorites list.
export const ACTIVE_LISTING_STATUSES: ProductStatus[] = [
  ProductStatus.AWAITING_FIRST_BID,
  ProductStatus.ACTIVE,
];

// Statuses a product can be in without ever having actually gone live for
// public sale. Everything else means it was approved and listed at some
// point, even if it has since closed or been abandoned — used to compute a
// seller's total listings count.
export const NEVER_LISTED_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.AWAITING_APPROVAL,
  ProductStatus.REJECTED,
  ProductStatus.WITHDRAWN,
];
