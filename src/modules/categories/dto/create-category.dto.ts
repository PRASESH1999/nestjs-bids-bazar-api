import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Electronics',
    description: 'Category name',
    minLength: 2,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Display order for sorting (lower = first)',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  displayOrder?: number;
}
