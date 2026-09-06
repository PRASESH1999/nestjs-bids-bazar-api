import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
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

  @ApiPropertyOptional({
    description: 'Plain-text product specifications',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  specifications?: string;

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

  @ApiPropertyOptional({
    description:
      'Zero-based index of the uploaded image to use as the preview thumbnail (defaults to 0)',
    minimum: 0,
    maximum: 7,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(7)
  @IsOptional()
  previewImageIndex?: number;

  // ─── Pickup location ────────────────────────────────────────────────────
  // Independent per product — a seller with multiple listings sets this
  // separately for each one; never reused across products.

  @ApiProperty({ description: 'Pickup location: province' })
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiProperty({ description: 'Pickup location: district' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ description: 'Pickup location: city' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'Pickup location: street' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ description: 'Pickup location: ward number', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  wardNumber: number;

  @ApiPropertyOptional({
    description:
      'Self-declared rarity badge. Subject to admin override on review.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRare?: boolean;
}
