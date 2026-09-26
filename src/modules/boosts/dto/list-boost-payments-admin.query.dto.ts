import { IsUuidShape } from '@common/validators/is-uuid-shape.decorator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum BoostPaymentSortBy {
  CREATED_AT = 'createdAt',
  AMOUNT = 'amount',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

// Powers the admin "boost payment records" page — includes FAILED/EXPIRED
// attempts (not just successful ones) so admins can spot patterns in failures.
export class ListBoostPaymentsAdminQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by seller (payer) UUID' })
  @IsOptional()
  // A user id — shape-checked; see IsUuidShape and OPEN-ITEMS A36.
  @IsUuidShape()
  sellerId?: string;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    enum: BoostPaymentSortBy,
    default: BoostPaymentSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(BoostPaymentSortBy)
  @Type(() => String)
  sortBy?: BoostPaymentSortBy = BoostPaymentSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  @Type(() => String)
  sortOrder?: SortOrder = SortOrder.DESC;
}
