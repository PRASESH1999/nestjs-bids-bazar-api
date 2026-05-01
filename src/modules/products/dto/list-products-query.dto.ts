import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { PaginationDto } from '@common/dto/pagination.dto';

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
}
