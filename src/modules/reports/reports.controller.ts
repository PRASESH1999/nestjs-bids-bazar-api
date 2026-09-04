import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { R401, R403, R404, R409, R429 } from '@common/swagger/api-responses';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('products/:productId')
  @RequirePermissions(Permission.REPORT_SUBMIT)
  @ApiOperation({
    summary: 'Report a product — the report is effectively against its seller',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @ApiResponse(R409)
  @ApiResponse(R429)
  async reportProduct(
    @Param('productId') productId: string,
    @Body() dto: CreateReportDto,
    @Request() req: RequestWithUser,
  ) {
    return this.reportsService.reportProduct(
      req.user.sub,
      productId,
      dto.remarks,
    );
  }

  @Get()
  @RequirePermissions(Permission.REPORT_MANAGE)
  @ApiOperation({
    summary: 'Admin: list product reports, filterable by status and seller',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  async listReports(@Query() query: ListReportsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.reportsService.listReports(page, limit, {
      status: query.status,
      reportedUserId: query.reportedUserId,
    });
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.REPORT_MANAGE)
  @ApiOperation({ summary: "Admin: update a report's status" })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  async updateReportStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, dto.status, dto.adminNote);
  }
}
