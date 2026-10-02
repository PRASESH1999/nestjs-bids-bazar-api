import { IsUuidShape } from '@common/validators/is-uuid-shape.decorator';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { PaymentStatus } from '@common/enums/payment-status.enum';

export enum PaymentSortBy {
  CREATED_AT = 'createdAt',
  AMOUNT = 'amount',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

// Powers the admin "payment records" page — includes FAILED/EXPIRED attempts
// (not just successful ones) so admins can spot patterns in payment failures.
export class ListPaymentsAdminQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by winner (buyer) UUID' })
  @IsOptional()
  // A user id — shape-checked; see IsUuidShape and OPEN-ITEMS A36.
  @IsUuidShape()
  winnerUserId?: string;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    enum: PaymentSortBy,
    default: PaymentSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(PaymentSortBy)
  @Type(() => String)
  sortBy?: PaymentSortBy = PaymentSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  @Type(() => String)
  sortOrder?: SortOrder = SortOrder.DESC;
}
