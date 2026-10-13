import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { PaymentMethod } from '@common/enums/payment-method.enum';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import type { BuyerDeliveryView } from '@modules/pathao/dto/delivery-view.dto';

// ─── Controller request DTOs ───────────────────────────────────────────────

export class GetBanksQueryDto {
  @IsOptional()
  @IsString()
  mobileNo?: string;
}

export class InitiatePaymentDto {
  /**
   * Which of the buyer's saved addresses to ship to.
   *
   * Required — there is no way to fulfil a sale without a Pathao-resolvable
   * address (Rule 14). Resolved, ownership-checked, and validated as being
   * inside our current serviceable area (Kathmandu Valley) before a QR is
   * ever generated. Its id is kept on the payment row so the later gateway
   * confirmation can find it again; the frozen recipient/address detail
   * itself lives on ProductDelivery, created only once payment succeeds.
   */
  @ApiProperty({
    format: 'uuid',
    description: 'One of your saved delivery addresses.',
  })
  @IsUUID()
  shippingAddressId: string;
}

// ─── Controller response DTOs ──────────────────────────────────────────────

/** What the parcel is addressed to — from the live address (pre-success) or
 * the frozen ProductDelivery snapshot (post-success). */
export interface PaymentShippingAddressView {
  recipientName: string;
  recipientPhone: string;
  province: string;
  district: string;
  city: string;
  street: string;
  wardNumber: string | null;
  landmark: string | null;
  /** Pathao's names for the courier location, for display. */
  pathaoCityName: string | null;
  pathaoZoneName: string | null;
  pathaoAreaName: string | null;
}

export interface InitiatePaymentResponseDto {
  paymentId: string;
  referenceLabel: string;
  /** The amount the Fonepay QR is generated for — item + delivery, bundled. */
  amount: number;
  /*
   * The stored breakdown. Neither field used to be returned at all, so a client
   * showing a delivery line had to hardcode the tariff and go silently wrong
   * the day it changed. See OPEN-ITEMS A3.
   */
  itemAmount: number;
  deliveryCharge: number;
  /** Where the parcel is addressed. */
  shippingAddress: PaymentShippingAddressView | null;
  qrString: string;
  qrMessage: string;
  status: PaymentStatus;
  paymentDeadline: string;
}

export interface PaymentStatusResponseDto {
  paymentId: string;
  referenceLabel: string;
  /** FONEPAY (prepaid) or COD (status COD_PENDING until the rider collects). */
  method: PaymentMethod;
  /** Item + delivery — paid via the QR, or owed to the rider for COD. */
  amount: number;
  itemAmount: number;
  deliveryCharge: number;
  shippingAddress: PaymentShippingAddressView | null;
  status: PaymentStatus;
  paymentDeadline: string;
  fonepayTraceId: string | null;
  paymentMessage: string | null;
  /**
   * Where the parcel is. Null until the payment succeeds or cash on delivery
   * is chosen (the delivery record is created by an event listener, so it can
   * also lag a just-confirmed payment by a moment).
   */
  delivery: BuyerDeliveryView | null;
}

/** `GET /payments/:productId/cod/eligibility` — whether to offer the COD option. */
export interface CodEligibilityResponseDto {
  available: boolean;
  /** Why COD is unavailable, for display. Null when available. */
  reason: string | null;
  /** Null when the product is not awaiting the caller's payment at all. */
  itemAmount: number | null;
  deliveryCharge: number | null;
  /** Item + delivery — what the rider would collect. */
  amount: number | null;
  /** COD_MAX_AMOUNT — orders above this must be prepaid. */
  maxAmount: number;
}
