import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RejectProductDto {
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  rejectionReason: string;

  @ApiPropertyOptional({
    description: "Admin override of the seller's rarity badge",
  })
  @IsBoolean()
  @IsOptional()
  isRare?: boolean;
}
