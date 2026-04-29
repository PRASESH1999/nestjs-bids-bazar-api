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
  Query,
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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  R400,
  R401,
  R403,
  R404,
  R409,
  SubcategorySchema,
  SuccessResponse,
} from '@common/swagger/api-responses';
import { memoryStorage } from 'multer';
import { Public } from '@common/decorators/public.decorator';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Permission } from '@common/enums/permission.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import { CategoriesService } from './categories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';

@ApiTags('subcategories')
@Controller('subcategories')
@UseGuards(PermissionsGuard)
export class SubcategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary:
      'List active subcategories (public). Use ?categoryId=xxx for cascading dropdown.',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by parent category UUID',
  })
  @ApiResponse({ status: 200, description: 'Array of active subcategories, ordered by displayOrder then name. Pass ?categoryId to filter by parent.', schema: { type: 'array', items: SubcategorySchema } })
  async listSubcategories(@Query('categoryId') categoryId?: string) {
    return this.categoriesService.listSubcategories({
      categoryId,
      includeInactive: false,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subcategory by ID (Admin/SuperAdmin only)' })
  @ApiResponse({ status: 200, description: 'Subcategory object.', schema: SubcategorySchema })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async getSubcategoryById(@Param('id') id: string) {
    return this.categoriesService.getSubcategoryById(id);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subcategory (Admin/SuperAdmin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['categoryId', 'name'],
      properties: {
        categoryId: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Mobile Phones' },
        displayOrder: { type: 'number', example: 0 },
        icon: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Subcategory created.', schema: SubcategorySchema })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse({ status: 404, description: 'Parent category not found or inactive.', ...R404 })
  @ApiResponse(R409)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  @UseInterceptors(FileInterceptor('icon', { storage: memoryStorage() }))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createSubcategory(
    @Body() dto: CreateSubcategoryDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.categoriesService.createSubcategory(dto, icon);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a subcategory (Admin/SuperAdmin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', format: 'uuid' },
        name: { type: 'string', example: 'Mobile Phones' },
        displayOrder: { type: 'number', example: 0 },
        isActive: { type: 'boolean', example: true },
        icon: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated subcategory object.', schema: SubcategorySchema })
  @ApiResponse(R400)
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @ApiResponse(R409)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  @UseInterceptors(FileInterceptor('icon', { storage: memoryStorage() }))
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateSubcategory(
    @Param('id') id: string,
    @Body() dto: UpdateSubcategoryDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.categoriesService.updateSubcategory(id, dto, icon);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft-delete a subcategory (Admin/SuperAdmin only)' })
  @ApiResponse({ status: 200, description: 'Subcategory deactivated (isActive set to false).', ...SuccessResponse })
  @ApiResponse(R401)
  @ApiResponse(R403)
  @ApiResponse(R404)
  @RequirePermissions(Permission.CATEGORY_MANAGE)
  async deleteSubcategory(@Param('id') id: string) {
    await this.categoriesService.deleteSubcategory(id);
    return { success: true };
  }
}
