import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { ReorderTaxonomyDto } from './dto/reorder-taxonomy.dto';

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
  @ApiQuery({
    name: 'withCounts',
    required: false,
    type: Boolean,
    description:
      'Include subcategoryCount on each row (one grouped query, not one per row).',
  })
  @ApiResponse({
    status: 200,
    description:
      'All categories (active + inactive when includeInactive=true).',
    schema: { type: 'array', items: CategorySchema },
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async listAllCategories(
    @Query('includeInactive') includeInactive?: string,
    @Query('withCounts') withCounts?: string,
  ) {
    return this.categoriesService.listCategories(
      includeInactive === 'true',
      withCounts === 'true',
    );
  }

  @Get('subcategories')
  @ApiOperation({
    summary:
      'List all subcategories including inactive (Admin/SuperAdmin only).',
  })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description:
      'All subcategories (active + inactive when includeInactive=true). Filter by categoryId to get subcategories for a specific parent.',
    schema: { type: 'array', items: SubcategorySchema },
  })
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

  // ─── Bulk reorder (A18) ──────────────────────────────────────────────────

  @Patch('categories/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Apply a whole new category display order in one transaction (Admin/SuperAdmin only).',
  })
  @ApiResponse({ status: 200, description: 'Order applied.' })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async reorderCategories(@Body() dto: ReorderTaxonomyDto) {
    await this.categoriesService.reorderCategories(dto);
    return { success: true };
  }

  @Patch('subcategories/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Apply a whole new subcategory display order in one transaction (Admin/SuperAdmin only).',
  })
  @ApiResponse({ status: 200, description: 'Order applied.' })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async reorderSubcategories(@Body() dto: ReorderTaxonomyDto) {
    await this.categoriesService.reorderSubcategories(dto);
    return { success: true };
  }

  // ─── Hard delete (A19) ───────────────────────────────────────────────────

  @Delete('categories/:id/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Permanently delete a category that nothing references (Admin/SuperAdmin only). Use DELETE /categories/:id to merely deactivate.',
  })
  @ApiResponse({ status: 200, description: 'Category removed.' })
  @ApiResponse({
    status: 409,
    description:
      'Subcategories or listings still reference this category — deactivate it instead.',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async hardDeleteCategory(@Param('id') id: string) {
    await this.categoriesService.hardDeleteCategory(id);
    return { success: true };
  }

  @Delete('subcategories/:id/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Permanently delete a subcategory that no listing references (Admin/SuperAdmin only).',
  })
  @ApiResponse({ status: 200, description: 'Subcategory removed.' })
  @ApiResponse({
    status: 409,
    description: 'Listings still reference this subcategory.',
  })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async hardDeleteSubcategory(@Param('id') id: string) {
    await this.categoriesService.hardDeleteSubcategory(id);
    return { success: true };
  }
}
