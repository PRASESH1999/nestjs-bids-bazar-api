import { IsUuidShape } from '@common/validators/is-uuid-shape.decorator';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { ReportStatus } from '@common/enums/report-status.enum';

export class ListReportsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiPropertyOptional({ description: 'Filter by the reported seller' })
  // A user id — shape-checked; see IsUuidShape and OPEN-ITEMS A36.
  @IsUuidShape()
  @IsOptional()
  reportedUserId?: string;
}
