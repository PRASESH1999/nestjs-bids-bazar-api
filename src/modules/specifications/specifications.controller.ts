import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  R400,
  R401,
  R403,
  R404,
  R409,
  SpecificationSchema,
  SuccessResponse,
} from '@common/swagger/api-responses';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { SpecificationsService } from './specifications.service';
import { CreateSpecificationDto } from './dto/create-specification.dto';
import { UpdateSpecificationDto } from './dto/update-specification.dto';

@ApiTags('specifications')
@Controller('specifications')
@UseGuards(PermissionsGuard)
export class SpecificationsController {
  constructor(private readonly specificationsService: SpecificationsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active specifications (public)' })
  @ApiResponse({
    status: 200,
    description:
      'Array of active specifications, ordered by displayOrder then name.',
    schema: { type: 'array', items: SpecificationSchema },
  })
  async listSpecifications() {
    return this.specificationsService.listSpecifications(false);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get specification by ID (public)' })
  @ApiResponse({
    status: 200,
    description: 'Specification object.',
    schema: SpecificationSchema,
  })
  @ApiResponse(R404)
  async getSpecificationById(@Param('id') id: string) {
    return this.specificationsService.getSpecificationById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new specification (Admin/SuperAdmin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Specification created.',
    schema: SpecificationSchema,
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R409)
  @RequirePermissions(Permission.SPECIFICATION_MANAGE)
  async createSpecification(@Body() dto: CreateSpecificationDto) {
    return this.specificationsService.createSpecification(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a specification (Admin/SuperAdmin only)' })
  @ApiResponse({
    status: 200,
    description: 'Updated specification object.',
    schema: SpecificationSchema,
  })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @ApiResponse(R409)
  @RequirePermissions(Permission.SPECIFICATION_MANAGE)
  async updateSpecification(
    @Param('id') id: string,
    @Body() dto: UpdateSpecificationDto,
  ) {
    return this.specificationsService.updateSpecification(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Soft-delete a specification (Admin/SuperAdmin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Specification deactivated (isActive set to false).',
    ...SuccessResponse,
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.SPECIFICATION_MANAGE)
  async deleteSpecification(@Param('id') id: string) {
    await this.specificationsService.deleteSpecification(id);
    return { success: true };
  }
}
