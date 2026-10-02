import { IsUuidShape } from '@common/validators/is-uuid-shape.decorator';
import { PaginationDto } from '@common/dto/pagination.dto';
import { BoostItemStatus } from '@common/enums/boost-item-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum BoostItemSortBy {
  CREATED_AT = 'createdAt',
  START_DATE_TIME = 'startDateTime',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

// Powers the admin "boosted items" page — every row regardless of status
// (PENDING_PAYMENT/ACTIVE/EXPIRED/CANCELLED).
export class ListBoostItemsAdminQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by product UUID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filter by seller UUID' })
  @IsOptional()
  // A user id — shape-checked; see IsUuidShape and OPEN-ITEMS A36.
  @IsUuidShape()
  sellerId?: string;

  @ApiPropertyOptional({
    enum: BoostItemStatus,
    description: 'Filter by boost item status',
  })
  @IsOptional()
  @IsEnum(BoostItemStatus)
  status?: BoostItemStatus;

  @ApiPropertyOptional({
    enum: BoostItemSortBy,
    default: BoostItemSortBy.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(BoostItemSortBy)
  @Type(() => String)
  sortBy?: BoostItemSortBy = BoostItemSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  @Type(() => String)
  sortOrder?: SortOrder = SortOrder.DESC;
}
