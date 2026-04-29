import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CategorySchema,
  R401,
  R403,
  SubcategorySchema,
} from '@common/swagger/api-responses';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { CategoriesService } from './categories.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PermissionsGuard)
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('categories')
  @ApiOperation({
    summary:
      'List all categories including inactive (Admin/SuperAdmin only). Use ?includeInactive=true.',
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'All categories (active + inactive when includeInactive=true).', schema: { type: 'array', items: CategorySchema } })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async listAllCategories(@Query('includeInactive') includeInactive?: string) {
    return this.categoriesService.listCategories(includeInactive === 'true');
  }

  @Get('subcategories')
  @ApiOperation({
    summary:
      'List all subcategories including inactive (Admin/SuperAdmin only).',
  })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'All subcategories (active + inactive when includeInactive=true). Filter by categoryId to get subcategories for a specific parent.', schema: { type: 'array', items: SubcategorySchema } })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async listAllSubcategories(
    @Query('categoryId') categoryId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.categoriesService.listSubcategories({
      categoryId,
      includeInactive: includeInactive === 'true',
    });
  }
}
