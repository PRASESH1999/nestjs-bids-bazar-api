import { BoostItemStatus } from '@common/enums/boost-item-status.enum';
import { BoostScheme } from '@common/enums/boost-scheme.enum';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

// ─── Controller request DTOs ───────────────────────────────────────────────

export class InitiateBoostDto {
  @ApiProperty({
    enum: BoostScheme,
    description: 'Which boost plan to purchase — see GET /boosts/plans',
    example: BoostScheme.SEVEN_DAYS,
  })
  @IsEnum(BoostScheme)
  scheme: BoostScheme;
}

// ─── Controller response DTOs ──────────────────────────────────────────────

export interface InitiateBoostResponseDto {
  boostItemId: string;
  paymentId: string;
  referenceLabel: string;
  scheme: BoostScheme;
  amount: number;
  qrString: string;
  qrMessage: string;
  status: PaymentStatus;
  paymentDeadline: string;
}

export interface BoostStatusResponseDto {
  boostItemId: string;
  paymentId: string;
  scheme: BoostScheme;
  boostStatus: BoostItemStatus;
  amount: number;
  paymentStatus: PaymentStatus;
  startDateTime: string | null;
  endDateTime: string | null;
  fonepayTraceId: string | null;
  paymentMessage: string | null;
}
