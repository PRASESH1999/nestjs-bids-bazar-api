import { IsEnum, IsOptional } from 'class-validator';
import { IsUuidShape } from '@common/validators/is-uuid-shape.decorator';
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

  /*
   * `GET /kyc/:id` takes the KYC row's id, not the user's, so without this
   * there was no way to ask "does this user have a KYC?" — callers paged the
   * whole list and matched client-side, capped at the maximum page size.
   * See OPEN-ITEMS A10.
   */
  @ApiPropertyOptional({
    description: 'Filter by the owning user id',
    format: 'uuid',
  })
  // Shape-checked, not `@IsUUID()`: the admin user page looks KYC up by the
  // account's id, and six seeded accounts have non-v4 ids. See IsUuidShape.
  @IsUuidShape()
  @IsOptional()
  userId?: string;
}
