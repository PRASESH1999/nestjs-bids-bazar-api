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

// Everything a visitor may open: live lots, and every lot whose auction has
// run — sold or not. ABANDONED (no buyer completed payment) is included so the
// listing's page, photos and bid history stay reachable after the auction,
// the same as a SETTLED lot; a relisted one points at its replacement through
// `relistedProductId`.
export const PUBLICLY_VISIBLE_STATUSES: ProductStatus[] = [
  ProductStatus.AWAITING_FIRST_BID,
  ProductStatus.ACTIVE,
  ProductStatus.AWAITING_PAYMENT,
  ProductStatus.SETTLED,
  ProductStatus.ABANDONED,
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
