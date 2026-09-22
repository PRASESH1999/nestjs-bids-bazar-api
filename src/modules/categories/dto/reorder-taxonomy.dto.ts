import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderEntryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ minimum: 0, description: 'New position, 0-based.' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder: number;
}

/**
 * Bulk reorder for categories or subcategories.
 *
 * Dragging one row to a new position renumbers every row between the old and
 * new slot, and with only `PATCH /categories/:id` available a client had to
 * fire one request per affected row. That is N requests for one user action,
 * and a failure part-way leaves the order half-written with no way back. This
 * applies the whole new order in a single transaction. See OPEN-ITEMS A18.
 */
export class ReorderTaxonomyDto {
  @ApiProperty({ type: [ReorderEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  // A marketplace taxonomy is tens of rows; this is a guard against an
  // unbounded body, not a real product limit.
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  items: ReorderEntryDto[];
}
