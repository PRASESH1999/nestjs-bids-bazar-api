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
