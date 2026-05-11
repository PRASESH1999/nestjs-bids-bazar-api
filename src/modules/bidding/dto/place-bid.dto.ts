import { IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PlaceBidDto {
  @ApiProperty({
    description:
      'Bid amount in NPR. Must be positive with at most 2 decimal places.',
    example: 1100.0,
  })
  @IsPositive()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  amount: number;
}
