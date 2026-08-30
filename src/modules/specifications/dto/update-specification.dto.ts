import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSpecificationDto } from './create-specification.dto';

export class UpdateSpecificationDto extends PartialType(
  CreateSpecificationDto,
) {
  @ApiPropertyOptional({
    example: true,
    description: 'Set active or inactive status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
