import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { PaginationDto } from '@common/dto/pagination.dto';

export enum ProductSortBy {
  PRICE = 'price',
  ENDING_SOON = 'endingSoon',
  NEWEST = 'newest',
}

export enum ProductSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListProductsQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  subcategoryId?: string;

  @ApiPropertyOptional({ enum: ItemCondition })
  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition;

  @ApiPropertyOptional({
    description: 'Case-insensitive search on title and description',
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Minimum bidding start price (inclusive)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum bidding start price (inclusive)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({
    description:
      'Sort field. `newest` (default) → createdAt DESC; `price` → biddingStartPrice (use `order`); `endingSoon` → soonest-ending first (NULLS LAST; `order` ignored).',
    enum: ProductSortBy,
    default: ProductSortBy.NEWEST,
  })
  @IsEnum(ProductSortBy)
  @IsOptional()
  sortBy?: ProductSortBy = ProductSortBy.NEWEST;

  @ApiPropertyOptional({
    description:
      'Sort direction. Applied to `sortBy=price`; ignored for `endingSoon` and `newest`.',
    enum: ProductSortOrder,
    default: ProductSortOrder.DESC,
  })
  @IsEnum(ProductSortOrder)
  @IsOptional()
  order?: ProductSortOrder = ProductSortOrder.DESC;
}
