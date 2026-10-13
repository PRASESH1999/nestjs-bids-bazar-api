export enum PaymentStatus {
  PENDING = 'PENDING',
  // Cash on delivery chosen: the sale is settled to this buyer, but nothing is
  // collected until Pathao reports the parcel delivered (-> SUCCESS) or it
  // comes back refused (-> FAILED).
  COD_PENDING = 'COD_PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}
