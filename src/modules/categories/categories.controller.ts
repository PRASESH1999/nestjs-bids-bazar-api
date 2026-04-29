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
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CategorySchema,
  R400,
  R401,
  R403,
  R404,
  R409,
  SuccessResponse,
} from '@common/swagger/api-responses';
import { memoryStorage } from 'multer';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@Controller('categories')
@UseGuards(PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active categories (public)' })
  @ApiResponse({ status: 200, description: 'Array of active categories, ordered by displayOrder then name.', schema: { type: 'array', items: CategorySchema } })
  async listCategories() {
    return this.categoriesService.listCategories(false);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get category by ID (Admin/SuperAdmin only)' })
  @ApiResponse({ status: 200, description: 'Category object.', schema: CategorySchema })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (Admin/SuperAdmin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Electronics' },
        displayOrder: { type: 'number', example: 0 },
        icon: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Category created.', schema: CategorySchema })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R409)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  @UseInterceptors(FileInterceptor('icon', { storage: memoryStorage() }))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.categoriesService.createCategory(dto, icon);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category (Admin/SuperAdmin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Electronics' },
        displayOrder: { type: 'number', example: 0 },
        isActive: { type: 'boolean', example: true },
        icon: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated category object.', schema: CategorySchema })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @ApiResponse(R409)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  @UseInterceptors(FileInterceptor('icon', { storage: memoryStorage() }))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.categoriesService.updateCategory(id, dto, icon);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete a category (Admin/SuperAdmin only)' })
  @ApiResponse({ status: 200, description: 'Category deactivated (isActive set to false). Hard delete is not performed.', ...SuccessResponse })
  @ApiResponse({ status: 409, description: 'Cannot deactivate — category has active subcategories. Deactivate subcategories first.', ...R409 })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async deleteCategory(@Param('id') id: string) {
    await this.categoriesService.deleteCategory(id);
    return { success: true };
  }
}
