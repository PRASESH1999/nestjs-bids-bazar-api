import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';

// ─── Controller request DTOs ───────────────────────────────────────────────

export class GetBanksQueryDto {
  @IsOptional()
  @IsString()
  mobileNo?: string;
}

export class InitiatePaymentDto {
  // Buyer-selected at checkout — determines which fixed COD delivery fee
  // applies. Never derived from an address/location field (Rule 14).
  @IsEnum(DeliveryZone)
  deliveryZone: DeliveryZone;
}

// ─── Controller response DTOs ──────────────────────────────────────────────

export interface InitiatePaymentResponseDto {
  paymentId: string;
  referenceLabel: string;
  amount: number;
  qrString: string;
  qrMessage: string;
  status: PaymentStatus;
  paymentDeadline: string;
}

export interface PaymentStatusResponseDto {
  paymentId: string;
  referenceLabel: string;
  amount: number;
  status: PaymentStatus;
  paymentDeadline: string;
  fonepayTraceId: string | null;
  paymentMessage: string | null;
}
