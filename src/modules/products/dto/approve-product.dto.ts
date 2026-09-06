import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveProductDto {
  @ApiPropertyOptional({
    description: "Admin override of the seller's rarity badge",
  })
  @IsBoolean()
  @IsOptional()
  isRare?: boolean;
}
