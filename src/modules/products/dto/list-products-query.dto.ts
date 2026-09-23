import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { ProductScope } from '@common/enums/product-scope.enum';
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
  /*
   * Shape-checked rather than `@IsUUID()`, to agree with `GET /sellers/:id`.
   *
   * Nest's ParseUUIDPipe accepts any hex UUID shape; class-validator's
   * `@IsUUID()` additionally demands a version nibble of 1–5 and an RFC variant.
   * Six of the twelve seeded accounts are hand-written fixtures
   * (`00000000-0000-0000-0000-00000000000N`) that satisfy the first and fail
   * the second — so with `@IsUUID()` a seeded seller's profile page loads and
   * then its lots tabs answer 400, which is a worse failure than either rule on
   * its own. Real accounts are v4 and pass both.
   *
   * Looking an id up is this endpoint's job; policing its version nibble is
   * not, and an id that matches nothing is a 404 either way. The seed fixtures
   * are the actual defect — see OPEN-ITEMS A36.
   */
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
    message: 'sellerId must be a UUID',
  })
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
