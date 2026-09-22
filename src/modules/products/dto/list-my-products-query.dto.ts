import { IsEnum, IsOptional } from 'class-validator';
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
  @ApiPropertyOptional({
    enum: ProductStatus,
    description: 'Filter your own listings by status.',
  })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;
}
