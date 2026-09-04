import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@common/dto/pagination.dto';
import { ReportStatus } from '@common/enums/report-status.enum';

export class ListReportsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @ApiPropertyOptional({ description: 'Filter by the reported seller' })
  @IsUUID()
  @IsOptional()
  reportedUserId?: string;
}
