import {
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
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { existsSync, createReadStream } from 'fs';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { RequirePermissions } from '@common/decorators/require-permissions.decorator';
import { Public } from '@common/decorators/public.decorator';
import { Permission } from '@common/enums/permission.enum';
import { Role } from '@common/enums/role.enum';
import { PermissionsGuard } from '@common/guards/permissions.guard';
import type { RequestWithUser } from '@common/interfaces/request-with-user.interface';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RejectProductDto } from './dto/reject-product.dto';
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
  @ApiOperation({ summary: 'Get a publicly visible product by ID' })
  async getPublicProduct(@Param('id') id: string) {
    return this.productsService.getPublicProductById(id);
  }

  @Get('products/:id/images/:imageId')
  @Public()
  @ApiOperation({ summary: 'Stream a product image file' })
  async getProductImage(
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
}
