import { ArrayUnique, IsArray, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@common/enums/product-status.enum';
import { ListProductsQueryDto } from './list-products-query.dto';

/**
 * `GET /products/me`.
 *
 * Identical to the public product query plus `status`. It is a separate DTO
 * rather than a field on `ListProductsQueryDto` because that one also backs the
 * **public** `/products`, where letting a caller name a status would be a way
 * to ask for other people's DRAFT and REJECTED rows.
 *
 * Here the scope is already the caller's own listings (`ownerId` is forced from
 * the JWT in `listMyProducts`), so every status is theirs to filter by — which
 * is the whole point: My Listings could previously only sort and search, never
 * narrow to "my drafts". See OPEN-ITEMS A2.
 */
export class ListMyProductsQueryDto extends ListProductsQueryDto {
  /*
   * One status, or several.
   *
   * Several, because the statuses a seller thinks of as one thing are often two
   * of ours: "live" is AWAITING_FIRST_BID **and** ACTIVE, "closed" is ABANDONED
   * **and** WITHDRAWN. With a single value a client had to either show ten
   * separate tabs or merge two paginated responses in the browser — and merging
   * makes the page numbers and the result count wrong, which is worse than the
   * extra tabs. See OPEN-ITEMS A30.
   *
   * Accepts a repeated parameter or a comma-separated list, since neither
   * arrives as a JSON array on a query string. Same shape as
   * `UpdateProductDto.clearFields`, which solved the same problem on a
   * multipart body.
   */
  @ApiPropertyOptional({
    isArray: true,
    enum: ProductStatus,
    description:
      'Filter your own listings by status. Repeat the parameter or comma-separate it for several; any of them matches.',
  })
  @Transform(({ value }): unknown => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
    return value;
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(ProductStatus, { each: true })
  @IsOptional()
  status?: ProductStatus[];
}
