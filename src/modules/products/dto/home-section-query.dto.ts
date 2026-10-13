import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';

/**
 * Query for the paginated home-page sections (`/products/home/trending-bids`,
 * `new-arrivals`, `rare-items`, `recently-sold`, `featured`).
 *
 * Same as `PaginationDto` except the page size defaults to 10 — a home-page
 * row shows 10 cards without asking, and a "view all" page passes its own
 * `limit`.
 */
export class HomeSectionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}
