import { IsUuidShape } from '@common/validators/is-uuid-shape.decorator';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@common/enums/product-status.enum';
import { ListProductsQueryDto } from './list-products-query.dto';

export class AdminListProductsQueryDto extends ListProductsQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional()
  // A user id — shape-checked; see IsUuidShape and OPEN-ITEMS A36.
  @IsUuidShape()
  @IsOptional()
  ownerId?: string;
}
