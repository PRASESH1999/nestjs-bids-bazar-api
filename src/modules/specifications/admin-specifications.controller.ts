import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { R401, R403, SpecificationSchema } from '@common/swagger/api-responses';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { SpecificationsService } from './specifications.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PermissionsGuard)
export class AdminSpecificationsController {
  constructor(private readonly specificationsService: SpecificationsService) {}

  @Get('specifications')
  @ApiOperation({
    summary:
      'List all specifications including inactive (Admin/SuperAdmin only). Use ?includeInactive=true.',
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description:
      'All specifications (active + inactive when includeInactive=true).',
    schema: { type: 'array', items: SpecificationSchema },
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.SPECIFICATION_MANAGE)
  async listAllSpecifications(
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.specificationsService.listSpecifications(
      includeInactive === 'true',
    );
  }
}
