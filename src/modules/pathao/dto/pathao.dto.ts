import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ─── Pathao API shapes (raw, as returned by their sandbox/live API) ───────────

export interface PathaoIssueTokenRawResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface PathaoCity {
  cityId: number;
  cityName: string;
}

export interface PathaoZone {
  zoneId: number;
  zoneName: string;
}

export interface PathaoArea {
  areaId: number;
  areaName: string;
  homeDeliveryAvailable: boolean;
  pickupAvailable: boolean;
}

export interface PathaoCreateOrderInput {
  storeId: number;
  merchantOrderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: number;
  recipientZone: number;
  recipientArea: number | null;
  itemQuantity: number;
  itemWeightKg: number;
  itemDescription: string;
  amountToCollect: number;
  specialInstruction?: string;
}

export interface PathaoCreateOrderResult {
  consignmentId: string;
  merchantOrderId: string;
  orderStatus: string;
  deliveryFee: number | null;
}

export interface PathaoOrderInfoResult {
  consignmentId: string;
  merchantOrderId: string | null;
  orderStatus: string;
  orderStatusSlug: string;
  updatedAt: string | null;
}

// ─── Controller DTOs ────────────────────────────────────────────────────────

export class DispatchDeliveryDto {
  @ApiProperty({
    example: 0.5,
    description: 'Weight in kg, as weighed at the warehouse (0.5–10).',
  })
  @IsNumber()
  @Min(0.5)
  @Max(10)
  itemWeightKg: number;

  @ApiPropertyOptional({ example: 'Vintage camera' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemDescription?: string;
}
