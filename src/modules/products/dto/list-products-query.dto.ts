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
import { ProductScope } from '@common/enums/product-scope.enum';
import { IsUuidShape } from '@common/validators/is-uuid-shape.decorator';
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
  /*
   * Whose listings to show.
   *
   * Public, and safe to be: the status filter below is not a caller's to set,
   * so this can only ever return the seller's *publicly visible* rows. Without
   * it there was no way to ask "what is this seller selling" at all — only
   * /admin/products could filter by owner — which is most of what a seller
   * profile page is. See OPEN-ITEMS A33.
   */
  @ApiPropertyOptional({
    description: "Only this seller's listings. Public statuses only.",
  })
  // Shape-checked, not `@IsUUID()` — see IsUuidShape and OPEN-ITEMS A36.
  @IsUuidShape()
  @IsOptional()
  sellerId?: string;

  /*
   * Which slice of the public statuses. Deliberately not a `status` filter —
   * see the ProductScope enum for why that distinction is load-bearing.
   */
  @ApiPropertyOptional({
    enum: ProductScope,
    description:
      '`live` → open for bidding (ACTIVE + AWAITING_FIRST_BID). `sold` → SETTLED. Omitted → every publicly visible status.',
  })
  @IsEnum(ProductScope)
  @IsOptional()
  scope?: ProductScope;

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
