export enum PaymentConfirmationMethod {
  ADMIN_MANUAL = 'ADMIN_MANUAL',
  BANK_API = 'BANK_API',
  // The winner chose cash on delivery — the win is locked in at that moment,
  // the cash itself is collected later by the Pathao rider.
  COD = 'COD',
}
