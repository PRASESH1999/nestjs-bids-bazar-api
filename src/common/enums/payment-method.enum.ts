/**
 * How the buyer settles a sale.
 *
 *   FONEPAY  prepaid through the Fonepay QR (item + delivery bundled), or
 *            confirmed manually by an admin for an offline payment
 *   COD      cash on delivery — the Pathao rider collects item + delivery at
 *            the door. Auction winners only; Instant Buy is always prepaid.
 */
export enum PaymentMethod {
  FONEPAY = 'FONEPAY',
  COD = 'COD',
}
