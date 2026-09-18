import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { ItemCondition } from '@common/enums/item-condition.enum';

// Every field is optional — a product starts life as an empty/partial DRAFT
// and is filled in incrementally via PATCH /products/:id (resilient to lost
// connections/power outages), then fully validated only at
// POST /products/:id/submit (see ProductsService.assertReadyForSubmission).
// Shape/format validators below still apply to whatever IS provided.
export class CreateProductDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 150 })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ minLength: 20, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Plain-text product specifications',
    maxLength: 5000,
  })
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  specifications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @ApiPropertyOptional({ enum: ItemCondition })
  @IsOptional()
  @IsEnum(ItemCondition)
  condition?: ItemCondition;

  @ApiPropertyOptional({
    description:
      'User desired sale price (NPR). Whole rupees only, no decimals.',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  basePrice?: number;

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

  @ApiPropertyOptional({ description: 'Pickup location: province' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  province?: string;

  @ApiPropertyOptional({ description: 'Pickup location: district' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  district?: string;

  @ApiPropertyOptional({ description: 'Pickup location: city' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @ApiPropertyOptional({ description: 'Pickup location: street' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  street?: string;

  @ApiPropertyOptional({
    description: 'Pickup location: ward number',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  wardNumber?: number;

  @ApiPropertyOptional({
    description:
      'Self-declared rarity badge. Subject to admin override on review.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRare?: boolean;
}
