import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Response as NestResponse,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { existsSync, createReadStream } from 'fs';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Public } from '@common/decorators/public.decorator';
import { OptionalJwtGuard } from '@common/guards/optional-jwt.guard';
import { Permission } from '@common/enums/permission.enum';
import { Role } from '@common/enums/role.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { SetPreviewImageDto } from './dto/set-preview-image.dto';
import { ReorderImagesDto } from './dto/reorder-images.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { AdminListProductsQueryDto } from './dto/admin-list-products-query.dto';

const multerOptions = { storage: memoryStorage() };

@ApiTags('products')
@ApiBearerAuth()
@Controller()
@UseGuards(PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── Public endpoints ────────────────────────────────────────────────────

  @Get('products')
  @Public()
  @ApiOperation({ summary: 'List publicly visible products' })
  async listPublicProducts(@Query() query: ListProductsQueryDto) {
    return this.productsService.listPublicProducts(query);
  }

  @Get('products/calculate-bidding-price')
  @Public()
  @ApiOperation({
    summary: 'Calculate the bidding start price for a given base price',
  })
  calculateBiddingPrice(@Query('basePrice') basePrice: string) {
    const price = parseFloat(basePrice);
    if (isNaN(price) || price <= 0) {
      throw new BadRequestException('basePrice must be a positive number');
    }
    const biddingStartPrice =
      this.productsService.computeBiddingStartPrice(price);
    return { basePrice: price, biddingStartPrice };
  }

  @Get('products/me')
  @RequirePermissions(Permission.PRODUCT_VIEW_OWN)
  @ApiOperation({ summary: 'List own products (all statuses)' })
  async listMyProducts(
    @Request() req: RequestWithUser,
    @Query() query: ListProductsQueryDto,
  ) {
    return this.productsService.listMyProducts(req.user.sub, query);
  }

  @Get('products/:id')
  @Public()
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary:
      'Get a product by ID (owner can view own product regardless of status)',
  })
  async getPublicProduct(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    const requesterId =
      (req.user as RequestWithUser['user'] | undefined)?.sub ?? null;
    return this.productsService.getPublicProductById(id, requesterId);
  }

  @Get('products/:id/images/:imageId')
  @Public()
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({ summary: 'Stream a product image file' })
  async getProductImage(
    @Param('id') productId: string,
    @Param('imageId') imageId: string,
    @Request() req: RequestWithUser,
    @NestResponse({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const requesterId =
      (req.user as RequestWithUser['user'] | undefined)?.sub ?? null;
    const isAdmin =
      (req.user as RequestWithUser['user'] | undefined)?.role === Role.ADMIN ||
      (req.user as RequestWithUser['user'] | undefined)?.role ===
        Role.SUPERADMIN;

    const { absolutePath, mimeType } =
      await this.productsService.getProductImageFile(
        productId,
        imageId,
        requesterId,
        isAdmin,
      );

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Image file not found on server');
    }

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
    });

    return new StreamableFile(createReadStream(absolutePath));
  }

  // ─── User endpoints ───────────────────────────────────────────────────────

  @Post('products')
  @RequirePermissions(Permission.PRODUCT_CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new product listing (KYC required)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'title',
        'description',
        'categoryId',
        'subcategoryId',
        'condition',
        'basePrice',
      ],
      properties: {
        title: { type: 'string', minLength: 5, maxLength: 150 },
        description: { type: 'string', minLength: 20, maxLength: 5000 },
        specifications: {
          type: 'string',
          maxLength: 5000,
          description: 'Plain-text product specifications (optional)',
        },
        categoryId: { type: 'string', format: 'uuid' },
        subcategoryId: { type: 'string', format: 'uuid' },
        condition: { type: 'string', enum: Object.values(ItemCondition) },
        basePrice: { type: 'number', minimum: 1 },
        biddingDurationHours: {
          type: 'integer',
          minimum: 1,
          maximum: 720,
          default: 72,
        },
        previewImageIndex: {
          type: 'integer',
          minimum: 0,
          maximum: 7,
          default: 0,
          description:
            'Zero-based index of the image to use as the preview thumbnail',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Product images (up to 8)',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('images', 8, multerOptions))
  async createProduct(
    @Request() req: RequestWithUser,
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.createProduct(req.user.sub, dto, files ?? []);
  }

  @Patch('products/:id')
  @RequirePermissions(Permission.PRODUCT_MANAGE_OWN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update own product (DRAFT or REJECTED only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 5, maxLength: 150 },
        description: { type: 'string', minLength: 20, maxLength: 5000 },
        specifications: {
          type: 'string',
          maxLength: 5000,
          description: 'Plain-text product specifications (optional)',
        },
        categoryId: { type: 'string', format: 'uuid' },
        subcategoryId: { type: 'string', format: 'uuid' },
        condition: { type: 'string', enum: Object.values(ItemCondition) },
        basePrice: { type: 'number', minimum: 1 },
        biddingDurationHours: {
          type: 'integer',
          minimum: 1,
          maximum: 720,
          default: 72,
        },
        previewImageIndex: {
          type: 'integer',
          minimum: 0,
          maximum: 7,
          default: 0,
          description:
            'Zero-based index of the new image set to use as preview thumbnail',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Product images (up to 8)',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('images', 8, multerOptions))
  async updateProduct(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.updateProduct(
      req.user.sub,
      id,
      dto,
      files?.length ? files : undefined,
    );
  }

  @Post('products/:id/submit')
  @RequirePermissions(Permission.PRODUCT_MANAGE_OWN)
  @ApiOperation({ summary: 'Submit product for admin review' })
  async submitProduct(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.productsService.submitProduct(req.user.sub, id);
  }

  @Post('products/:id/withdraw')
  @RequirePermissions(Permission.PRODUCT_MANAGE_OWN)
  @ApiOperation({ summary: 'Withdraw a product from listing' })
  async withdrawProduct(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    await this.productsService.withdrawProduct(req.user.sub, id);
    return { message: 'Product withdrawn successfully' };
  }

  @Delete('products/:id')
  @RequirePermissions(Permission.PRODUCT_MANAGE_OWN)
  @ApiOperation({ summary: 'Hard-delete own product (DRAFT or REJECTED only)' })
  async deleteProduct(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    await this.productsService.deleteProduct(req.user.sub, id);
    return { message: 'Product deleted successfully' };
  }

  @Patch('products/:id/images/order')
  @RequirePermissions(Permission.PRODUCT_MANAGE_OWN)
  @ApiOperation({
    summary:
      'Reorder images for own product (DRAFT or REJECTED only). First ID becomes the preview.',
  })
  async reorderImages(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.productsService.reorderImages(
      id,
      dto.imageIds,
      req.user.sub,
      false,
    );
  }

  @Patch('products/:id/preview-image')
  @RequirePermissions(Permission.PRODUCT_MANAGE_OWN)
  @ApiOperation({
    summary:
      'Set the preview thumbnail image for own product (DRAFT or REJECTED only)',
  })
  async setPreviewImage(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: SetPreviewImageDto,
  ) {
    return this.productsService.setPreviewImage(
      id,
      dto.previewImageId,
      req.user.sub,
      false,
    );
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get('admin/products')
  @RequirePermissions(Permission.PRODUCT_VIEW_ALL)
  @ApiOperation({ summary: 'Admin: list all products (all statuses)' })
  async listAllProducts(@Query() query: AdminListProductsQueryDto) {
    return this.productsService.listAllProducts(query);
  }

  @Get('admin/products/:id')
  @RequirePermissions(Permission.PRODUCT_VIEW_ALL)
  @ApiOperation({ summary: 'Admin: get any product by ID' })
  async getAdminProduct(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.productsService.getProductForOwnerOrAdmin(
      req.user.sub,
      id,
      true,
    );
  }

  @Patch('admin/products/:id/approve')
  @RequirePermissions(Permission.PRODUCT_MODERATE)
  @ApiOperation({ summary: 'Admin: approve a submitted product' })
  async approveProduct(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.productsService.approveProduct(req.user.sub, id);
  }

  @Patch('admin/products/:id/reject')
  @RequirePermissions(Permission.PRODUCT_MODERATE)
  @ApiOperation({ summary: 'Admin: reject a submitted product with reason' })
  async rejectProduct(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: RejectProductDto,
  ) {
    return this.productsService.rejectProduct(req.user.sub, id, dto);
  }

  @Patch('admin/products/:id/images/order')
  @RequirePermissions(Permission.PRODUCT_MODERATE)
  @ApiOperation({
    summary:
      'Admin: reorder images for any product. First ID becomes the preview.',
  })
  async adminReorderImages(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.productsService.reorderImages(
      id,
      dto.imageIds,
      req.user.sub,
      true,
    );
  }

  @Patch('admin/products/:id/preview-image')
  @RequirePermissions(Permission.PRODUCT_MODERATE)
  @ApiOperation({
    summary: 'Admin: set the preview thumbnail image for any product',
  })
  async adminSetPreviewImage(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: SetPreviewImageDto,
  ) {
    return this.productsService.setPreviewImage(
      id,
      dto.previewImageId,
      req.user.sub,
      true,
    );
  }
}
