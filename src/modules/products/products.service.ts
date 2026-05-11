import {
  OWNER_EDITABLE_STATUSES,
  PUBLICLY_VISIBLE_STATUSES,
  ProductStatus,
} from '@common/enums/product-status.enum';
import { CategoriesService } from '@modules/categories/categories.service';
import { KycService } from '@modules/kyc/kyc.service';
import { MailService } from '@modules/mail/mail.service';
import { UsersService } from '@modules/users/users.service';
import { AuctionLifecycleService } from '@modules/bidding/services/auction-lifecycle.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdminListProductsQueryDto } from './dto/admin-list-products-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductStorageService } from './product-storage.service';
import { ProductsRepository } from './products.repository';

export type ProductImageResponse = {
  id: string;
  displayOrder: number;
  mimeType: string;
  url: string;
};

export type ProductResponse = Omit<Product, 'images'> & {
  previewImage: { id: string; url: string; mimeType: string } | null;
  images: ProductImageResponse[];
};

const AUCTION_ACTIVE_STATUSES: ProductStatus[] = [
  ProductStatus.ACTIVE,
  ProductStatus.CLOSED,
  ProductStatus.AWAITING_PAYMENT,
  ProductStatus.SETTLED,
  ProductStatus.PAYMENT_FAILED,
  ProductStatus.ABANDONED,
];

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly productStorage: ProductStorageService,
    private readonly kycService: KycService,
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
    private readonly mailService: MailService,
    private readonly auctionLifecycleService: AuctionLifecycleService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async createProduct(
    userId: string,
    dto: CreateProductDto,
    imageFiles: Express.Multer.File[],
  ): Promise<ProductResponse> {
    await this.assertKycApproved(userId);
    await this.assertCategoryAndSubcategory(dto.categoryId, dto.subcategoryId);

    if (!imageFiles || imageFiles.length === 0) {
      throw new BadRequestException('At least one product image is required');
    }
    if (imageFiles.length > 8) {
      throw new BadRequestException('A product can have at most 8 images');
    }

    this.productStorage.validateFiles(imageFiles);

    const previewIdx = Math.min(
      dto.previewImageIndex ?? 0,
      imageFiles.length - 1,
    );
    const orderedFiles = [
      imageFiles[previewIdx],
      ...imageFiles.slice(0, previewIdx),
      ...imageFiles.slice(previewIdx + 1),
    ];

    const biddingStartPrice = this.computeBiddingStartPrice(dto.basePrice);

    // Save product first to get the UUID for the image directory.
    const product = this.productsRepository.createProduct({
      ownerId: userId,
      title: dto.title,
      description: dto.description,
      specifications: dto.specifications ?? null,
      categoryId: dto.categoryId,
      subcategoryId: dto.subcategoryId,
      condition: dto.condition,
      basePrice: dto.basePrice,
      biddingStartPrice,
      biddingDurationHours: dto.biddingDurationHours ?? 72,
      status: ProductStatus.DRAFT,
      currentHighestBid: null,
      currentHighestBidderId: null,
      biddingStartedAt: null,
      biddingEndsAt: null,
      submittedAt: null,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      locationProvince: null,
      locationDistrict: null,
      locationArea: null,
      withdrawnAt: null,
    });

    const savedProduct = await this.productsRepository.saveProduct(product);

    const imageMeta = await this.productStorage.saveProductImages(
      savedProduct.id,
      orderedFiles,
    );

    const images = imageMeta.map((meta) =>
      this.productsRepository.createImage({
        productId: savedProduct.id,
        ...meta,
      }),
    );

    await this.productsRepository.saveImages(images);

    return this.mapProduct(
      (await this.productsRepository.findById(savedProduct.id)) as Product,
    );
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateProduct(
    userId: string,
    productId: string,
    dto: UpdateProductDto,
    newImageFiles?: Express.Multer.File[],
  ): Promise<ProductResponse> {
    const product = await this.findOwnedProduct(userId, productId);
    this.assertEditable(product);

    if (dto.categoryId || dto.subcategoryId) {
      await this.assertCategoryAndSubcategory(
        dto.categoryId ?? product.categoryId,
        dto.subcategoryId ?? product.subcategoryId,
      );
    }

    if (dto.title !== undefined) product.title = dto.title;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.specifications !== undefined)
      product.specifications = dto.specifications;
    if (dto.categoryId !== undefined) product.categoryId = dto.categoryId;
    if (dto.subcategoryId !== undefined)
      product.subcategoryId = dto.subcategoryId;
    if (dto.condition !== undefined) product.condition = dto.condition;
    if (dto.biddingDurationHours !== undefined)
      product.biddingDurationHours = dto.biddingDurationHours;

    if (dto.basePrice !== undefined) {
      product.basePrice = dto.basePrice;
      product.biddingStartPrice = this.computeBiddingStartPrice(dto.basePrice);
    }

    if (newImageFiles && newImageFiles.length > 0) {
      if (newImageFiles.length > 8) {
        throw new BadRequestException('A product can have at most 8 images');
      }
      this.productStorage.validateFiles(newImageFiles);

      const previewIdx = Math.min(
        dto.previewImageIndex ?? 0,
        newImageFiles.length - 1,
      );
      const orderedFiles = [
        newImageFiles[previewIdx],
        ...newImageFiles.slice(0, previewIdx),
        ...newImageFiles.slice(previewIdx + 1),
      ];

      const oldImages =
        await this.productsRepository.findImagesByProductId(productId);
      await this.productStorage.deleteProductImages(oldImages);
      await this.productsRepository.deleteImagesByProductId(productId);

      const imageMeta = await this.productStorage.saveProductImages(
        productId,
        orderedFiles,
      );
      const images = imageMeta.map((meta) =>
        this.productsRepository.createImage({ productId, ...meta }),
      );
      await this.productsRepository.saveImages(images);
    }

    await this.productsRepository.saveProduct(product);
    return this.mapProduct(
      (await this.productsRepository.findById(productId)) as Product,
    );
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async submitProduct(
    userId: string,
    productId: string,
  ): Promise<ProductResponse> {
    const product = await this.findOwnedProduct(userId, productId);
    this.assertEditable(product);

    const images =
      await this.productsRepository.findImagesByProductId(productId);
    if (images.length === 0) {
      throw new BadRequestException(
        'Product must have at least one image before submitting',
      );
    }

    if (product.status === ProductStatus.REJECTED) {
      product.rejectionReason = null;
      product.reviewedById = null;
      product.reviewedAt = null;
    }

    product.status = ProductStatus.SUBMITTED;
    product.submittedAt = new Date();

    const saved = await this.productsRepository.saveProduct(product);

    // Notify owner
    const user = await this.usersService.findById(userId);
    if (user) {
      await this.mailService.sendProductSubmitted(
        user.email,
        user.name,
        saved.title,
      );
    }

    return this.mapProduct(saved);
  }

  // ─── Withdraw ─────────────────────────────────────────────────────────────

  async withdrawProduct(userId: string, productId: string): Promise<void> {
    const product = await this.findOwnedProduct(userId, productId);

    if (AUCTION_ACTIVE_STATUSES.includes(product.status)) {
      throw new BadRequestException(
        'Cannot withdraw a product once bidding has started',
      );
    }

    const withdrawableStatuses: ProductStatus[] = [
      ProductStatus.DRAFT,
      ProductStatus.SUBMITTED,
      ProductStatus.REJECTED,
      ProductStatus.APPROVED,
      ProductStatus.PENDING,
    ];

    if (!withdrawableStatuses.includes(product.status)) {
      throw new BadRequestException(
        'Cannot withdraw product in its current status',
      );
    }

    product.status = ProductStatus.WITHDRAWN;
    product.withdrawnAt = new Date();
    await this.productsRepository.saveProduct(product);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteProduct(userId: string, productId: string): Promise<void> {
    const product = await this.findOwnedProduct(userId, productId);
    this.assertEditable(product);

    const images =
      await this.productsRepository.findImagesByProductId(productId);
    await this.productStorage.deleteProductImages(images);
    await this.productsRepository.deleteProduct(product);
  }

  // ─── Owner views ──────────────────────────────────────────────────────────

  async listMyProducts(
    userId: string,
    query: ListProductsQueryDto,
  ): Promise<{
    data: ProductResponse[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { page = 1, limit = 20, ...filters } = query;
    const [data, total] = await this.productsRepository.findPaginated(
      page,
      limit,
      {
        ...filters,
        ownerId: userId,
      },
    );
    return {
      data: data.map((p) => this.mapProduct(p)),
      meta: { page, limit, total },
    };
  }

  // ─── Public views ─────────────────────────────────────────────────────────

  async listPublicProducts(query: ListProductsQueryDto): Promise<{
    data: ProductResponse[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { page = 1, limit = 20, ...filters } = query;
    const [data, total] = await this.productsRepository.findPaginated(
      page,
      limit,
      {
        ...filters,
        statuses: PUBLICLY_VISIBLE_STATUSES,
      },
    );
    return {
      data: data.map((p) => this.mapProduct(p)),
      meta: { page, limit, total },
    };
  }

  async getPublicProductById(
    id: string,
    requesterId: string | null = null,
  ): Promise<ProductResponse> {
    let product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundException('Product not found');

    // Lazy auction-state trigger — idempotent and non-fatal.
    // Failures are logged and suppressed; the cron picks up the slack on the next tick.
    if (product.status === ProductStatus.ACTIVE) {
      try {
        await this.auctionLifecycleService.closeIfExpired(id);
        product = (await this.productsRepository.findById(id)) ?? product;
      } catch (err: unknown) {
        this.logger.error(
          `Lazy closeIfExpired failed for product ${id}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else if (product.status === ProductStatus.AWAITING_PAYMENT) {
      try {
        await this.auctionLifecycleService.handlePaymentExpiry(id);
        product = (await this.productsRepository.findById(id)) ?? product;
      } catch (err: unknown) {
        this.logger.error(
          `Lazy handlePaymentExpiry failed for product ${id}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const isOwner = requesterId !== null && product.ownerId === requesterId;
    if (!PUBLICLY_VISIBLE_STATUSES.includes(product.status) && !isOwner) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProduct(product);
  }

  async getProductImageFile(
    productId: string,
    imageId: string,
    requesterId: string | null,
    requesterIsAdmin: boolean,
  ): Promise<{ absolutePath: string; mimeType: string }> {
    const image = await this.productsRepository.findImageById(imageId);
    if (!image || image.productId !== productId)
      throw new NotFoundException('Image not found');

    const product = await this.productsRepository.findByIdWithoutImages(
      image.productId,
    );
    if (!product) throw new NotFoundException('Product not found');

    const isPubliclyVisible = PUBLICLY_VISIBLE_STATUSES.includes(
      product.status,
    );
    const isOwner = requesterId === product.ownerId;

    if (!isPubliclyVisible && !isOwner && !requesterIsAdmin) {
      throw new NotFoundException('Product not found');
    }

    return {
      absolutePath: this.productStorage.getAbsolutePath(image.filePath),
      mimeType: image.mimeType,
    };
  }

  // ─── Image order ──────────────────────────────────────────────────────────

  async reorderImages(
    productId: string,
    imageIds: string[],
    requesterId: string,
    isAdmin: boolean,
  ): Promise<ProductResponse> {
    const product =
      await this.productsRepository.findByIdWithoutImages(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (!isAdmin) {
      if (product.ownerId !== requesterId) {
        throw new ForbiddenException('You do not own this product');
      }
      this.assertEditable(product);
    }

    await this.productsRepository.reorderImages(productId, imageIds);
    return this.mapProduct(
      (await this.productsRepository.findById(productId)) as Product,
    );
  }

  // ─── Preview image ────────────────────────────────────────────────────────

  async setPreviewImage(
    productId: string,
    imageId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<ProductResponse> {
    const product =
      await this.productsRepository.findByIdWithoutImages(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (!isAdmin) {
      if (product.ownerId !== requesterId) {
        throw new ForbiddenException('You do not own this product');
      }
      this.assertEditable(product);
    }

    await this.productsRepository.setPreviewImage(productId, imageId);
    return this.mapProduct(
      (await this.productsRepository.findById(productId)) as Product,
    );
  }

  // ─── Owner or Admin view ──────────────────────────────────────────────────

  async getProductForOwnerOrAdmin(
    userId: string,
    productId: string,
    isAdmin: boolean,
  ): Promise<ProductResponse> {
    const product = await this.productsRepository.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (!isAdmin && product.ownerId !== userId) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProduct(product);
  }

  // ─── Admin moderation ─────────────────────────────────────────────────────

  async listAllProducts(query: AdminListProductsQueryDto): Promise<{
    data: ProductResponse[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { page = 1, limit = 20, status, ownerId, ...filters } = query;
    const [data, total] = await this.productsRepository.findPaginatedWithOwner(
      page,
      limit,
      { ...filters, status, ownerId },
    );
    return {
      data: data.map((p) => this.mapProduct(p)),
      meta: { page, limit, total },
    };
  }

  async approveProduct(
    adminId: string,
    productId: string,
  ): Promise<ProductResponse> {
    const product =
      await this.productsRepository.findByIdWithoutImages(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (product.status !== ProductStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only products in SUBMITTED status can be approved',
      );
    }

    // APPROVED is transient — immediately transition to PENDING (publicly listed,
    // awaiting first bid). This avoids a second round-trip.
    product.status = ProductStatus.PENDING;
    product.reviewedById = adminId;
    product.reviewedAt = new Date();

    const saved = await this.productsRepository.saveProduct(product);

    const owner = await this.usersService.findById(product.ownerId);
    if (owner) {
      await this.mailService.sendProductApproved(
        owner.email,
        owner.name,
        saved.title,
      );
    }

    return this.mapProduct(saved);
  }

  async rejectProduct(
    adminId: string,
    productId: string,
    dto: RejectProductDto,
  ): Promise<ProductResponse> {
    const product =
      await this.productsRepository.findByIdWithoutImages(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (product.status !== ProductStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only products in SUBMITTED status can be rejected',
      );
    }

    product.status = ProductStatus.REJECTED;
    product.rejectionReason = dto.rejectionReason;
    product.reviewedById = adminId;
    product.reviewedAt = new Date();

    const saved = await this.productsRepository.saveProduct(product);

    const owner = await this.usersService.findById(product.ownerId);
    if (owner) {
      await this.mailService.sendProductRejected(
        owner.email,
        owner.name,
        saved.title,
        dto.rejectionReason,
      );
    }

    return this.mapProduct(saved);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertKycApproved(userId: string): Promise<void> {
    const verified = await this.kycService.isVerified(userId);
    if (!verified) {
      throw new ForbiddenException(
        'KYC verification required to sell products. Please complete and submit your KYC.',
      );
    }
  }

  private async assertCategoryAndSubcategory(
    categoryId: string,
    subcategoryId: string,
  ): Promise<void> {
    const category = await this.categoriesService.getCategoryById(categoryId);
    if (!category.isActive) {
      throw new BadRequestException('Selected category is not active');
    }

    const subcategory =
      await this.categoriesService.getSubcategoryById(subcategoryId);
    if (!subcategory.isActive) {
      throw new BadRequestException('Selected subcategory is not active');
    }
    if (subcategory.categoryId !== categoryId) {
      throw new BadRequestException(
        'Subcategory does not belong to the selected category',
      );
    }
  }

  private async findOwnedProduct(
    userId: string,
    productId: string,
  ): Promise<Product> {
    const product =
      await this.productsRepository.findByIdWithoutImages(productId);
    if (!product) throw new NotFoundException('Product not found');
    if (product.ownerId !== userId) {
      throw new ForbiddenException('You do not own this product');
    }
    return product;
  }

  private assertEditable(product: Product): void {
    if (!OWNER_EDITABLE_STATUSES.includes(product.status)) {
      throw new BadRequestException(
        'Cannot edit product in its current status. Only DRAFT or REJECTED products can be edited.',
      );
    }
  }

  computeBiddingStartPrice(basePrice: number): number {
    let markup: number;
    if (basePrice <= 10000) markup = 0.2;
    else if (basePrice <= 20000) markup = 0.18;
    else if (basePrice <= 30000) markup = 0.16;
    else if (basePrice <= 40000) markup = 0.14;
    else if (basePrice <= 50000) markup = 0.12;
    else markup = 0.1;
    return Math.round(basePrice * (1 + markup) * 100) / 100;
  }

  private mapProduct(product: Product): ProductResponse {
    return {
      id: product.id,
      ownerId: product.ownerId,
      title: product.title,
      description: product.description,
      specifications: product.specifications,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      condition: product.condition,
      status: product.status,
      basePrice: product.basePrice,
      biddingStartPrice: product.biddingStartPrice,
      currency: product.currency,
      biddingDurationHours: product.biddingDurationHours,
      currentHighestBid: product.currentHighestBid,
      currentHighestBidderId: product.currentHighestBidderId,
      biddingStartedAt: product.biddingStartedAt,
      biddingEndsAt: product.biddingEndsAt,
      submittedAt: product.submittedAt,
      reviewedById: product.reviewedById,
      reviewedAt: product.reviewedAt,
      rejectionReason: product.rejectionReason,
      locationProvince: product.locationProvince,
      locationDistrict: product.locationDistrict,
      locationArea: product.locationArea,
      winningBidId: product.winningBidId,
      closedAt: product.closedAt,
      settledAt: product.settledAt,
      abandonedAt: product.abandonedAt,
      withdrawnAt: product.withdrawnAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
      previewImage: (() => {
        const p = product.images?.find((img) => img.displayOrder === 0);
        return p
          ? {
              id: p.id,
              url: `/api/v1/products/${product.id}/images/${p.id}`,
              mimeType: p.mimeType,
            }
          : null;
      })(),
      images:
        product.images?.map((img) => ({
          id: img.id,
          displayOrder: img.displayOrder,
          mimeType: img.mimeType,
          url: `/api/v1/products/${product.id}/images/${img.id}`,
        })) || [],
    };
  }
}
