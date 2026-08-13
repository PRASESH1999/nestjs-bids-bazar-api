import { IsEnum } from 'class-validator';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';

export class ConfirmPaymentManualDto {
  // Admin-entered on behalf of the buyer, since this path bypasses the
  // buyer-facing checkout that would normally capture the zone.
  @IsEnum(DeliveryZone)
  deliveryZone: DeliveryZone;
}
