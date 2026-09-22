import Decimal from 'decimal.js';
import {
  OWNER_EDITABLE_STATUSES,
  PUBLICLY_VISIBLE_STATUSES,
  ProductStatus,
} from '@common/enums/product-status.enum';
import {
  roundDownToMultipleOf5,
  roundUpToMultipleOf5,
} from '@common/utils/rounding.util';
import { CategoriesService } from '@modules/categories/categories.service';
import { KycService } from '@modules/kyc/kyc.service';
import { MailService } from '@modules/mail/mail.service';
import { UsersService } from '@modules/users/users.service';
import { AuctionLifecycleService } from '@modules/bidding/services/auction-lifecycle.service';
import {
  BiddingService,
  type PublicBidRange,
} from '@modules/bidding/services/bidding.service';
import { FavoritesService } from '@modules/favorites/favorites.service';
import { BoostsService } from '@modules/boosts/services/boosts.service';
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
import { ListMyProductsQueryDto } from './dto/list-my-products-query.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { ApproveProductDto } from './dto/approve-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductStorageService } from './product-storage.service';
import { ProductsRepository } from './products.repository';
import {
  computeMissingSubmissionFields,
  mapProduct,
  ProductResponse,
  ProductSellerSummary,
} from './products.mapper';

export type {
  ProductImageResponse,
  ProductResponse,
  ProductSellerSummary,
} from './products.mapper';

// Home-page cards need the bid count alongside the standard product shape.
export type HomeProductResponse = ProductResponse & { totalBids: number };

export type TopBidder = { username: string; highestBid: number };

export type WinningBidder = {
  id: string;
  username: string;
  winningBid: number;
};

// On the detail response the raw `winningBidId` pointer is replaced by the
// resolved `winningBidder` (bidder id + username + winning amount).
export type ProductDetailResponse = Omit<ProductResponse, 'winningBidId'> & {
  topBidders: TopBidder[];
  totalBids: number;
  newBidsToday: number;
  viewCount: number;
  winningBidder: WinningBidder | null;
  similarProducts: ProductResponse[];
  // What a bid on this lot may be, right now. Published so clients stop
  // re-implementing the server's increment and rounding rules. See A14.
  bidRange: PublicBidRange;
};

const AUCTION_ACTIVE_STATUSES: ProductStatus[] = [
  ProductStatus.ACTIVE,
  ProductStatus.AWAITING_PAYMENT,
  ProductStatus.SETTLED,
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
    private readonly biddingService: BiddingService,
    private readonly favoritesService: FavoritesService,
    private readonly boostsService: BoostsService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async createProduct(
    userId: string,
    dto: CreateProductDto,
    imageFiles: Express.Multer.File[],
  ): Promise<ProductResponse> {
    await this.assertKycApproved(userId);

    if (dto.categoryId && dto.subcategoryId) {
      await this.assertCategoryAndSubcategory(
        dto.categoryId,
        dto.subcategoryId,
      );
    }

    if (imageFiles && imageFiles.length > 8) {
      throw new BadRequestException('A product can have at most 8 images');
    }

    let orderedFiles: Express.Multer.File[] = [];
    if (imageFiles && imageFiles.length > 0) {
      this.productStorage.validateFiles(imageFiles);

      const previewIdx = Math.min(
        dto.previewImageIndex ?? 0,
        imageFiles.length - 1,
      );
      orderedFiles = [
        imageFiles[previewIdx],
        ...imageFiles.slice(0, previewIdx),
        ...imageFiles.slice(previewIdx + 1),
      ];
    }

    const biddingStartPrice =
      dto.basePrice !== undefined
        ? this.computeBiddingStartPrice(dto.basePrice)
        : null;
    const instantBuyPrice =
      dto.basePrice !== undefined
        ? this.computeInstantBuyPrice(dto.basePrice)
        : null;
    const biddingEndPrice =
      dto.basePrice !== undefined
        ? this.computeBiddingEndPrice(dto.basePrice)
        : null;

    // Save product first to get the UUID for the image directory.
    const product = this.productsRepository.createProduct({
      ownerId: userId,
      title: dto.title ?? null,
      description: dto.description ?? null,
      specifications: dto.specifications ?? null,
      categoryId: dto.categoryId ?? null,
      subcategoryId: dto.subcategoryId ?? null,
      condition: dto.condition ?? null,
      basePrice: dto.basePrice ?? null,
      biddingStartPrice,
      instantBuyPrice,
      biddingEndPrice,
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
      province: dto.province ?? null,
      district: dto.district ?? null,
      city: dto.city ?? null,
      street: dto.street ?? null,
      wardNumber: dto.wardNumber ?? null,
      withdrawnAt: null,
      isRare: dto.isRare ?? false,
    });

    const savedProduct = await this.productsRepository.saveProduct(product);

    if (orderedFiles.length > 0) {
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
    }

    const createdProduct = (await this.productsRepository.findById(
      savedProduct.id,
    )) as Product;
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      userId,
      [createdProduct],
    );
    return mapProduct(
      createdProduct,
      favoritedSet.has(createdProduct.id),
      sellerSummaries.get(createdProduct.ownerId) ?? null,
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

    if (dto.categoryId !== undefined || dto.subcategoryId !== undefined) {
      const resolvedCategoryId = dto.categoryId ?? product.categoryId;
      const resolvedSubcategoryId = dto.subcategoryId ?? product.subcategoryId;
      // Only re-validate once both sides of the pair are known — an
      // in-progress draft may still have one side unset, in which case the
      // check is deferred to submit time (assertReadyForSubmission).
      if (resolvedCategoryId && resolvedSubcategoryId) {
        await this.assertCategoryAndSubcategory(
          resolvedCategoryId,
          resolvedSubcategoryId,
        );
      }
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

    if (dto.province !== undefined) product.province = dto.province;
    if (dto.district !== undefined) product.district = dto.district;
    if (dto.city !== undefined) product.city = dto.city;
    if (dto.street !== undefined) product.street = dto.street;
    if (dto.wardNumber !== undefined) product.wardNumber = dto.wardNumber;
    if (dto.isRare !== undefined) product.isRare = dto.isRare;

    if (dto.basePrice !== undefined) {
      product.basePrice = dto.basePrice;
      product.biddingStartPrice = this.computeBiddingStartPrice(dto.basePrice);
      product.instantBuyPrice = this.computeInstantBuyPrice(dto.basePrice);
      product.biddingEndPrice = this.computeBiddingEndPrice(dto.basePrice);
    }

    /*
     * Explicit clears, applied last so that naming a field in both `clearFields`
     * and the body resolves to cleared — "remove this" is the more deliberate
     * of the two instructions.
     *
     * The DTO's @IsIn already restricts the names to CLEARABLE_PRODUCT_FIELDS,
     * every one of which is a nullable column. See OPEN-ITEMS A21.
     */
    if (dto.clearFields?.length) {
      for (const field of dto.clearFields) {
        product[field] = null;
        // basePrice is the input the other three prices are derived from, so
        // clearing it has to clear them too or the draft keeps a bidding
        // ceiling computed from a price that is no longer there.
        if (field === 'basePrice') {
          product.biddingStartPrice = null;
          product.instantBuyPrice = null;
          product.biddingEndPrice = null;
        }
      }
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
    const updatedProduct = (await this.productsRepository.findById(
      productId,
    )) as Product;
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      userId,
      [updatedProduct],
    );
    return mapProduct(
      updatedProduct,
      favoritedSet.has(updatedProduct.id),
      sellerSummaries.get(updatedProduct.ownerId) ?? null,
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
    await this.assertReadyForSubmission(product, images.length);

    if (product.status === ProductStatus.REJECTED) {
      product.rejectionReason = null;
      product.reviewedById = null;
      product.reviewedAt = null;
    }

    product.status = ProductStatus.AWAITING_APPROVAL;
    product.submittedAt = new Date();

    const saved = await this.productsRepository.saveProduct(product);

    // Notify owner
    const user = await this.usersService.findById(userId);
    if (user) {
      // Non-null: assertReadyForSubmission above guarantees title is set.
      await this.mailService.sendProductSubmitted(
        user.email,
        user.username,
        saved.title!,
      );
    }

    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      userId,
      [saved],
    );
    return mapProduct(
      saved,
      favoritedSet.has(saved.id),
      sellerSummaries.get(saved.ownerId) ?? null,
    );
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
      ProductStatus.AWAITING_APPROVAL,
      ProductStatus.REJECTED,
      ProductStatus.AWAITING_FIRST_BID,
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
    query: ListMyProductsQueryDto,
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
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      userId,
      data,
    );
    return {
      data: data.map((p) =>
        mapProduct(
          p,
          favoritedSet.has(p.id),
          sellerSummaries.get(p.ownerId) ?? null,
        ),
      ),
      meta: { page, limit, total },
    };
  }

  // ─── Public views ─────────────────────────────────────────────────────────

  async listPublicProducts(
    query: ListProductsQueryDto,
    requesterId: string | null = null,
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
        statuses: PUBLICLY_VISIBLE_STATUSES,
      },
    );
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      data,
    );
    return {
      data: data.map((p) =>
        mapProduct(
          p,
          favoritedSet.has(p.id),
          sellerSummaries.get(p.ownerId) ?? null,
        ),
      ),
      meta: { page, limit, total },
    };
  }

  async getPublicProductById(
    id: string,
    requesterId: string | null = null,
  ): Promise<ProductDetailResponse> {
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

    // Detail-page metadata fetched in parallel — none depend on each other.
    const [
      topBidders,
      bidCounts,
      winningBidder,
      similarProducts,
      { favoritedSet, sellerSummaries },
    ] = await Promise.all([
      this.biddingService.getTopBiddersForProduct(id),
      this.biddingService.getBidCountsForProduct(id),
      this.biddingService.getWinningBidder(product.winningBidId),
      this.getSimilarProducts(product, 5, requesterId),
      this.responseContextFor(requesterId, [product]),
    ]);

    // The raw winningBidId pointer is replaced by the resolved winningBidder.
    const { winningBidId: _winningBidId, ...productBase } = mapProduct(
      product,
      favoritedSet.has(product.id),
      sellerSummaries.get(product.ownerId) ?? null,
    );

    return {
      ...productBase,
      topBidders,
      totalBids: bidCounts.totalBids,
      newBidsToday: bidCounts.newBidsToday,
      viewCount: product.viewCount,
      winningBidder,
      similarProducts,
      bidRange: this.biddingService.getPublicBidRange(product),
    };
  }

  // ─── Home page ────────────────────────────────────────────────────────────

  // The single hottest ACTIVE product — most bids, ties broken by soonest ending.
  async getHotProduct(
    requesterId: string | null = null,
  ): Promise<HomeProductResponse | null> {
    const result = await this.productsRepository.findHotProduct();
    if (!result) return null;
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      [result.product],
    );
    return {
      ...mapProduct(
        result.product,
        favoritedSet.has(result.product.id),
        sellerSummaries.get(result.product.ownerId) ?? null,
      ),
      totalBids: result.totalBids,
    };
  }

  // Top 10 ACTIVE products ranked by bid count.
  async getTrendingProducts(
    requesterId: string | null = null,
  ): Promise<HomeProductResponse[]> {
    const results = await this.productsRepository.findTrendingProducts(10);
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      results.map((r) => r.product),
    );
    return results.map((r) => ({
      ...mapProduct(
        r.product,
        favoritedSet.has(r.product.id),
        sellerSummaries.get(r.product.ownerId) ?? null,
      ),
      totalBids: r.totalBids,
    }));
  }

  // 10 most recently listed PENDING products (bidding hasn't started yet).
  async getNewArrivals(
    requesterId: string | null = null,
  ): Promise<HomeProductResponse[]> {
    const results = await this.productsRepository.findNewestProducts(10);
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      results.map((r) => r.product),
    );
    return results.map((r) => ({
      ...mapProduct(
        r.product,
        favoritedSet.has(r.product.id),
        sellerSummaries.get(r.product.ownerId) ?? null,
      ),
      totalBids: r.totalBids,
    }));
  }

  // 10 most recently listed rare products (PENDING or ACTIVE).
  async getRareItems(
    requesterId: string | null = null,
  ): Promise<HomeProductResponse[]> {
    const results = await this.productsRepository.findRareProducts(10);
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      results.map((r) => r.product),
    );
    return results.map((r) => ({
      ...mapProduct(
        r.product,
        favoritedSet.has(r.product.id),
        sellerSummaries.get(r.product.ownerId) ?? null,
      ),
      totalBids: r.totalBids,
    }));
  }

  // 10 most recently SETTLED (sold) products.
  async getRecentlySold(
    requesterId: string | null = null,
  ): Promise<HomeProductResponse[]> {
    const results = await this.productsRepository.findRecentlySoldProducts(10);
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      results.map((r) => r.product),
    );
    return results.map((r) => ({
      ...mapProduct(
        r.product,
        favoritedSet.has(r.product.id),
        sellerSummaries.get(r.product.ownerId) ?? null,
      ),
      totalBids: r.totalBids,
    }));
  }

  // Paginated boosted products, latest boost first — a product drops out the
  // moment either its boost window or its auction ends, whichever is first
  // (see BoostsService.getFeaturedProductIds).
  async getFeaturedProducts(
    page: number,
    limit: number,
    requesterId: string | null = null,
  ): Promise<{
    data: HomeProductResponse[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { ids, total } = await this.boostsService.getFeaturedProductIds(
      page,
      limit,
    );
    const results = await this.productsRepository.findFeaturedRanked(ids);
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      results.map((r) => r.product),
    );
    return {
      data: results.map((r) => ({
        ...mapProduct(
          r.product,
          favoritedSet.has(r.product.id),
          sellerSummaries.get(r.product.ownerId) ?? null,
        ),
        totalBids: r.totalBids,
      })),
      meta: { page, limit, total },
    };
  }

  // ─── View tracking ────────────────────────────────────────────────────────

  /**
   * Fire-and-forget view counter for the product detail page. Never throws —
   * a tracking failure must not surface to the user. Skips the increment for
   * the owner, any admin, and non-publicly-visible products.
   */
  async trackView(
    productId: string,
    requesterId: string | null,
    isAdmin: boolean,
  ): Promise<void> {
    try {
      const product =
        await this.productsRepository.findByIdWithoutImages(productId);
      if (!product) return; // tracking call, not a fetch — stay silent

      if (product.ownerId === requesterId) return; // owner viewing own product
      if (isAdmin) return; // ADMIN / SUPERADMIN views don't count
      if (!PUBLICLY_VISIBLE_STATUSES.includes(product.status)) return;

      await this.productsRepository.incrementViewCount(productId);
    } catch (err: unknown) {
      this.logger.error(
        `trackView failed for product ${productId}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Similar products ─────────────────────────────────────────────────────

  /**
   * Up to `limit` related products using a tiered fallback, stopping as soon as
   * the quota is filled: same subcategory → same category → random biddable.
   * Only PENDING/ACTIVE products are eligible. Returns `[]` if nothing matches.
   */
  async getSimilarProducts(
    product: Product,
    limit = 5,
    requesterId: string | null = null,
  ): Promise<ProductResponse[]> {
    const collected: Product[] = [];
    const excludeIds = [product.id];

    const tiers: Array<'subcategory' | 'category' | 'random'> = [
      'subcategory',
      'category',
      'random',
    ];

    for (const scope of tiers) {
      if (collected.length >= limit) break;
      // Non-null: only PENDING/ACTIVE products (past submission) call this.
      const found = await this.productsRepository.findSimilar(scope, {
        categoryId: product.categoryId!,
        subcategoryId: product.subcategoryId!,
        excludeIds,
        limit: limit - collected.length,
      });
      collected.push(...found);
      excludeIds.push(...found.map((p) => p.id));
    }

    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      collected,
    );
    return collected.map((p) =>
      mapProduct(
        p,
        favoritedSet.has(p.id),
        sellerSummaries.get(p.ownerId) ?? null,
      ),
    );
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
    const reordered = (await this.productsRepository.findById(
      productId,
    )) as Product;
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      [reordered],
    );
    return mapProduct(
      reordered,
      favoritedSet.has(reordered.id),
      sellerSummaries.get(reordered.ownerId) ?? null,
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
    const updated = (await this.productsRepository.findById(
      productId,
    )) as Product;
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      [updated],
    );
    return mapProduct(
      updated,
      favoritedSet.has(updated.id),
      sellerSummaries.get(updated.ownerId) ?? null,
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

    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      userId,
      [product],
    );
    return mapProduct(
      product,
      favoritedSet.has(product.id),
      sellerSummaries.get(product.ownerId) ?? null,
    );
  }

  // ─── Admin moderation ─────────────────────────────────────────────────────

  async listAllProducts(
    query: AdminListProductsQueryDto,
    requesterId: string | null = null,
  ): Promise<{
    data: ProductResponse[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { page = 1, limit = 20, status, ownerId, ...filters } = query;
    const [data, total] = await this.productsRepository.findPaginatedWithOwner(
      page,
      limit,
      { ...filters, status, ownerId },
    );
    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      requesterId,
      data,
    );
    return {
      data: data.map((p) =>
        mapProduct(
          p,
          favoritedSet.has(p.id),
          sellerSummaries.get(p.ownerId) ?? null,
        ),
      ),
      meta: { page, limit, total },
    };
  }

  async approveProduct(
    adminId: string,
    productId: string,
    dto: ApproveProductDto = {},
  ): Promise<ProductResponse> {
    const product =
      await this.productsRepository.findByIdWithoutImages(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (product.status !== ProductStatus.AWAITING_APPROVAL) {
      throw new BadRequestException(
        'Only products in AWAITING_APPROVAL status can be approved',
      );
    }

    product.status = ProductStatus.AWAITING_FIRST_BID;
    product.reviewedById = adminId;
    product.reviewedAt = new Date();
    if (dto.isRare !== undefined) product.isRare = dto.isRare;

    const saved = await this.productsRepository.saveProduct(product);

    const owner = await this.usersService.findById(product.ownerId);
    if (owner) {
      // Non-null: only SUBMITTED products (already past assertReadyForSubmission) reach here.
      await this.mailService.sendProductApproved(
        owner.email,
        owner.username,
        saved.title!,
      );
    }

    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      adminId,
      [saved],
    );
    return mapProduct(
      saved,
      favoritedSet.has(saved.id),
      sellerSummaries.get(saved.ownerId) ?? null,
    );
  }

  async rejectProduct(
    adminId: string,
    productId: string,
    dto: RejectProductDto,
  ): Promise<ProductResponse> {
    const product =
      await this.productsRepository.findByIdWithoutImages(productId);
    if (!product) throw new NotFoundException('Product not found');

    if (product.status !== ProductStatus.AWAITING_APPROVAL) {
      throw new BadRequestException(
        'Only products in AWAITING_APPROVAL status can be rejected',
      );
    }

    product.status = ProductStatus.REJECTED;
    product.rejectionReason = dto.rejectionReason;
    product.reviewedById = adminId;
    product.reviewedAt = new Date();
    if (dto.isRare !== undefined) product.isRare = dto.isRare;

    const saved = await this.productsRepository.saveProduct(product);

    const owner = await this.usersService.findById(product.ownerId);
    if (owner) {
      // Non-null: only SUBMITTED products (already past assertReadyForSubmission) reach here.
      await this.mailService.sendProductRejected(
        owner.email,
        owner.username,
        saved.title!,
        dto.rejectionReason,
      );
    }

    const { favoritedSet, sellerSummaries } = await this.responseContextFor(
      adminId,
      [saved],
    );
    return mapProduct(
      saved,
      favoritedSet.has(saved.id),
      sellerSummaries.get(saved.ownerId) ?? null,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertKycApproved(userId: string): Promise<void> {
    const verified = await this.kycService.isVerified(userId);
    if (!verified) {
      throw new ForbiddenException(
        'KYC verification required to sell products. Please complete and submit your KYC.',
      );
    }

    const hasBankDetails = await this.kycService.hasBankDetails(userId);
    if (!hasBankDetails) {
      throw new ForbiddenException(
        'Bank details required to sell products. Please add your bank details.',
      );
    }
  }

  // Full-completeness gate for POST /products/:id/submit — this is where a
  // DRAFT's partially-filled fields (optional at create/update time) finally
  // become mandatory. Reports every missing/invalid field at once rather
  // than one BadRequestException per retry.
  private async assertReadyForSubmission(
    product: Product,
    imageCount: number,
  ): Promise<void> {
    // The rule itself lives in the mapper so the same list can be *published*
    // on the owner's listings, not only thrown. See OPEN-ITEMS A20.
    const missingFields = computeMissingSubmissionFields(product, imageCount);

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Product is missing required fields for submission',
        missingFields,
        // Mirrored into the filter's own `fields` shape so the list actually
        // reaches the client — `missingFields` alone used to be dropped by
        // GlobalExceptionFilter.
        fields: missingFields.map((field) => ({
          field,
          message: 'is required before this listing can be submitted',
        })),
      });
    }

    // categoryId/subcategoryId are confirmed present above.
    await this.assertCategoryAndSubcategory(
      product.categoryId!,
      product.subcategoryId!,
    );
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

  // Floor value (minimum first bid) — rounds UP to the nearest multiple of 5
  // so the minimum is never weakened.
  computeBiddingStartPrice(basePrice: number): number {
    let markup: number;
    if (basePrice <= 10000) markup = 0.2;
    else if (basePrice <= 20000) markup = 0.18;
    else if (basePrice <= 30000) markup = 0.16;
    else if (basePrice <= 40000) markup = 0.14;
    else if (basePrice <= 50000) markup = 0.12;
    else markup = 0.1;
    return roundUpToMultipleOf5(
      new Decimal(basePrice).mul(new Decimal(1).plus(markup)),
    );
  }

  // Fixed buy-now price: 1.4 × basePrice. Always above biddingStartPrice
  // (max markup band is 1.2×), per Rule 13. Independent of biddingEndPrice —
  // Instant Buy availability is unaffected by the 60% bidding ceiling.
  // Ceiling value — rounds DOWN to the nearest multiple of 5 so it's never exceeded.
  computeInstantBuyPrice(basePrice: number): number {
    return roundDownToMultipleOf5(new Decimal(basePrice).mul(1.4));
  }

  // Hard ceiling on regular bidding: 1.6 × basePrice. Separate from
  // instantBuyPrice — once currentHighestBid reaches this, the auction closes
  // immediately regardless of the countdown timer (Rule 14). Ceiling value —
  // rounds DOWN to the nearest multiple of 5 so it's never exceeded.
  computeBiddingEndPrice(basePrice: number): number {
    return roundDownToMultipleOf5(new Decimal(basePrice).mul(1.6));
  }

  // Single batch query for the whole product list/detail being built — never
  // one favorites lookup per product. Returns an empty set for anonymous
  // requesters (requesterId === null) or when there's nothing to check.
  private async favoritedSetFor(
    requesterId: string | null,
    products: Product[],
  ): Promise<Set<string>> {
    return this.favoritesService.getFavoritedProductIds(
      requesterId,
      products.map((p) => p.id),
    );
  }

  // Single batch query for every distinct seller across the whole product
  // list/detail being built — never one lookup per product, and never one
  // per repeated seller within the same batch.
  private async sellerSummaryFor(
    products: Product[],
  ): Promise<Map<string, ProductSellerSummary>> {
    return this.usersService.getPublicSellerSummaries(
      products.map((p) => p.ownerId),
    );
  }

  // Both batch lookups needed to build a ProductResponse, fetched together
  // since neither depends on the other.
  private async responseContextFor(
    requesterId: string | null,
    products: Product[],
  ): Promise<{
    favoritedSet: Set<string>;
    sellerSummaries: Map<string, ProductSellerSummary>;
  }> {
    const [favoritedSet, sellerSummaries] = await Promise.all([
      this.favoritedSetFor(requesterId, products),
      this.sellerSummaryFor(products),
    ]);
    return { favoritedSet, sellerSummaries };
  }
}
