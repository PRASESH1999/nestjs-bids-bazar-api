import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubcategoryDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Parent category UUID',
  })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    example: 'Mobile Phones',
    description: 'Subcategory name',
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
