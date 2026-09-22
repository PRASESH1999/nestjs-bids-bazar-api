import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';
import type { ShippingAddressSnapshot } from '../entities/product-payment.entity';

// ─── Controller request DTOs ───────────────────────────────────────────────

export class GetBanksQueryDto {
  @IsOptional()
  @IsString()
  mobileNo?: string;
}

export class InitiatePaymentDto {
  // Buyer-selected at checkout — determines which fixed COD delivery fee
  // applies. Never derived from an address/location field (Rule 14): a saved
  // address prefills the form, but the zone stays an explicit choice, so a
  // stale saved district can never silently change what someone pays.
  @IsEnum(DeliveryZone)
  deliveryZone: DeliveryZone;

  /**
   * Which of the buyer's saved addresses to ship to.
   *
   * Optional: payments predate saved addresses, and a buyer who has saved none
   * can still pay. When given it is resolved, ownership-checked, and
   * **snapshotted** onto the payment — later edits to the saved address must
   * not rewrite where a past order went.
   */
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'One of your saved delivery addresses.',
  })
  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;
}

// ─── Controller response DTOs ──────────────────────────────────────────────

export interface InitiatePaymentResponseDto {
  paymentId: string;
  referenceLabel: string;
  /**
   * The amount the Fonepay QR is generated for — the winning bid, item only.
   *
   * NOTE: this is **not** item + delivery. `deliveryCharge` is computed and
   * stored on the payment row but is not added to the QR amount, so it is not
   * collected through the gateway. That is existing behaviour, surfaced rather
   * than changed here; see OPEN-ITEMS A28.
   */
  amount: number;
  /*
   * The stored breakdown. Neither field used to be returned at all, so a client
   * showing a delivery line had to hardcode the tariff and go silently wrong
   * the day it changed. See OPEN-ITEMS A3.
   */
  itemAmount: number;
  deliveryCharge: number;
  deliveryZone: DeliveryZone;
  /** Where the parcel is addressed, frozen at payment time. */
  shippingAddress: ShippingAddressSnapshot | null;
  qrString: string;
  qrMessage: string;
  status: PaymentStatus;
  paymentDeadline: string;
}

export interface PaymentStatusResponseDto {
  paymentId: string;
  referenceLabel: string;
  amount: number;
  itemAmount: number;
  deliveryCharge: number;
  deliveryZone: DeliveryZone;
  shippingAddress: ShippingAddressSnapshot | null;
  status: PaymentStatus;
  paymentDeadline: string;
  fonepayTraceId: string | null;
  paymentMessage: string | null;
}
