import {
  IsEnum,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ItemCondition } from '@common/enums/item-condition.enum';

export class CreateProductDto {
  @ApiProperty({ minLength: 5, maxLength: 150 })
  @IsString()
  @MinLength(5)
  @MaxLength(150)
  title: string;

  @ApiProperty({ minLength: 20, maxLength: 5000 })
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiProperty()
  @IsUUID()
  subcategoryId: string;

  @ApiProperty({ enum: ItemCondition })
  @IsEnum(ItemCondition)
  condition: ItemCondition;

  @ApiProperty({ description: 'User desired sale price (NPR)', minimum: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  basePrice: number;

  @ApiPropertyOptional({
    description: 'Countdown duration in hours after the first bid is placed',
    minimum: 1,
    maximum: 720,
    default: 72,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  @IsOptional()
  biddingDurationHours?: number;
}
