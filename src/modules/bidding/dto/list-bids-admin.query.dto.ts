import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';

export enum BidSortBy {
  AMOUNT = 'amount',
  PLACED_AT = 'placedAt',
  PAYMENT_STATUS = 'paymentStatus',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListBidsAdminQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by bidder UUID' })
  @IsOptional()
  @IsUUID()
  bidderId?: string;

  @ApiPropertyOptional({
    enum: BidPaymentStatus,
    description: 'Filter by payment status',
  })
  @IsOptional()
  @IsEnum(BidPaymentStatus)
  paymentStatus?: BidPaymentStatus;

  @ApiPropertyOptional({ enum: BidSortBy, default: BidSortBy.PLACED_AT })
  @IsOptional()
  @IsEnum(BidSortBy)
  @Type(() => String)
  sortBy?: BidSortBy = BidSortBy.PLACED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  @Type(() => String)
  sortOrder?: SortOrder = SortOrder.DESC;
}
