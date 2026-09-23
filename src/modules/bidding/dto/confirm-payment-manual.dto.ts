import { IsUUID } from 'class-validator';

export class ConfirmPaymentManualDto {
  // Admin-entered on behalf of the buyer, since this path bypasses the
  // buyer-facing checkout that would normally capture the delivery address.
  // Must belong to the winning bidder and already have a Pathao city/zone
  // resolved — see AuctionLifecycleService.confirmPaymentManual.
  @IsUUID()
  shippingAddressId: string;
}
