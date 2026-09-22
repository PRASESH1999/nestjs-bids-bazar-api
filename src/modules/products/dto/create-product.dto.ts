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
import { Transform, Type } from 'class-transformer';
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
  /*
   * `POST /products` and `PATCH /products/:id` are multipart endpoints (they
   * carry the image files), and in a multipart body *every* value arrives as a
   * string. `@IsBoolean()` on its own therefore rejected the string `"true"`
   * and took the whole listing submission down with it, which is why the
   * seller-facing rarity control could not be built at all. See OPEN-ITEMS A16.
   *
   * Only the two canonical spellings are accepted; anything else is left
   * untouched so `@IsBoolean()` still reports it rather than silently reading
   * as false. A real boolean (a JSON body) passes straight through.
   */
  @Transform(({ value }): unknown => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as unknown;
  })
  @IsBoolean()
  @IsOptional()
  isRare?: boolean;
}
