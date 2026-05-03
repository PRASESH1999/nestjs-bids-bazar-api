import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FindKycDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: KycStatus,
    description: 'Filter by KYC status',
  })
  @IsEnum(KycStatus)
  @IsOptional()
  status?: KycStatus;
}
