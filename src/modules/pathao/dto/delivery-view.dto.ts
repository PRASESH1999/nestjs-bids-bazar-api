import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@common/dto/pagination.dto';
import type { PaginationMeta } from '@common/types/paginated-result.type';

/**
 * Where a paid-for parcel is, derived from the milestone timestamps on
 * ProductDelivery rather than stored — the timestamps are the source of truth
 * and a stored stage could drift from them.
 *
 *   AWAITING_WAREHOUSE  paid, seller has not handed the item in yet
 *   AT_WAREHOUSE        received, not yet handed to Pathao
 *   IN_TRANSIT          Pathao order created, not yet delivered
 *   DELIVERED           Pathao reported delivery
 */
export enum DeliveryStage {
  AWAITING_WAREHOUSE = 'AWAITING_WAREHOUSE',
  AT_WAREHOUSE = 'AT_WAREHOUSE',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
}

export class ListDeliveriesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DeliveryStage })
  @IsOptional()
  @IsEnum(DeliveryStage)
  stage?: DeliveryStage;
}

/** `GET /deliveries/quote` — what checkout needs before an address is chosen. */
export interface DeliveryQuoteDto {
  /** Flat fee added to the item price in the single Fonepay charge. */
  deliveryCharge: number;
  currency: 'NPR';
  /** Pathao city ids we can deliver to; any other city is refused at checkout. */
  serviceableCityIds: number[];
}

/**
 * The buyer's view of their parcel, embedded in the payment status response.
 * Deliberately omits admin-only detail (who handled it, Pathao's fee to us,
 * weight) — the buyer needs "where is it" and a consignment id to quote.
 */
export interface BuyerDeliveryView {
  id: string;
  stage: DeliveryStage;
  consignmentId: string | null;
  /** Pathao's own status string, once dispatched. */
  orderStatus: string | null;
  receivedAtWarehouseAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  lastStatusCheckAt: string | null;
}

/** One row of `GET /admin/deliveries`, and the body of every admin action. */
export interface AdminDeliveryView extends BuyerDeliveryView {
  productPaymentId: string;
  product: { id: string; title: string | null } | null;
  buyer: { id: string; username: string; email: string } | null;
  referenceLabel: string | null;
  itemAmount: number | null;
  deliveryCharge: number;
  recipientName: string;
  recipientPhone: string;
  province: string;
  district: string;
  city: string;
  street: string;
  wardNumber: string | null;
  landmark: string | null;
  pathaoCityId: number;
  pathaoCityName: string | null;
  pathaoZoneId: number;
  pathaoZoneName: string | null;
  pathaoAreaId: number | null;
  pathaoAreaName: string | null;
  storeId: number | null;
  itemWeightKg: number | null;
  itemDescription: string | null;
  pathaoDeliveryFee: number | null;
  createdAt: string;
}

export interface AdminDeliveryListDto {
  data: AdminDeliveryView[];
  meta: PaginationMeta;
  /** Per-stage totals across all deliveries, for the admin queue tabs. */
  counts: Record<DeliveryStage, number>;
}
