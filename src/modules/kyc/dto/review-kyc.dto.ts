import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewKycDto {
  @ApiProperty({ enum: ReviewAction })
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @ApiPropertyOptional({
    description: 'Required when action is REJECT',
    example: 'Document image is blurry or unreadable',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
