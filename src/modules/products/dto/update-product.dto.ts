import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * Fields a draft can have emptied again.
 *
 * Every one of these is nullable on the entity and optional until submission,
 * so clearing one returns the draft to a legitimate state. Pricing fields
 * derived from `basePrice` (`biddingStartPrice`, `instantBuyPrice`,
 * `biddingEndPrice`) are cleared with it rather than named separately — they
 * are computed, never set directly.
 */
export const CLEARABLE_PRODUCT_FIELDS = [
  'title',
  'description',
  'specifications',
  'categoryId',
  'subcategoryId',
  'condition',
  'basePrice',
  'province',
  'district',
  'city',
  'street',
  'wardNumber',
] as const;

export type ClearableProductField = (typeof CLEARABLE_PRODUCT_FIELDS)[number];

export class UpdateProductDto extends PartialType(CreateProductDto) {
  /*
   * Names of fields to set back to null.
   *
   * `PATCH` applies a field only when it is not `undefined`, so omitting one
   * keeps the old value — there was previously no way at all to say "remove
   * what I put there". A seller who cleared the description and saved found it
   * back on reload. See OPEN-ITEMS A21.
   *
   * This is an explicit list rather than "an empty string means clear", which
   * was the other obvious option and is a trap: a form that posts all of its
   * inputs sends `""` for every field the user simply has not filled in, so
   * that reading would silently wipe data on an ordinary save. Naming the
   * fields makes clearing something the client has to actually ask for.
   *
   * Accepts a repeated field or a comma-separated string, since this endpoint
   * is multipart and neither arrives as a JSON array.
   */
  @ApiPropertyOptional({
    isArray: true,
    enum: CLEARABLE_PRODUCT_FIELDS,
    description:
      'Field names to reset to null. Comma-separated or repeated. Applied after any values in the same request, so sending a field and also clearing it clears it.',
  })
  @Transform(({ value }): unknown => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    }
    return value;
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(CLEARABLE_PRODUCT_FIELDS, { each: true })
  @IsOptional()
  clearFields?: ClearableProductField[];
}
