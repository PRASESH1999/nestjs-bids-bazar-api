import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { ProductStatus } from '@common/enums/product-status.enum';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';

export interface ProductFilters {
  categoryId?: string;
  subcategoryId?: string;
  condition?: ItemCondition;
  keyword?: string;
  status?: ProductStatus;
  ownerId?: string;
  statuses?: ProductStatus[];
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'endingSoon' | 'newest';
  order?: 'asc' | 'desc';
}

@Injectable()
export class ProductsRepository {
  private readonly productRepo: Repository<Product>;
  private readonly imageRepo: Repository<ProductImage>;

  constructor(private readonly dataSource: DataSource) {
    this.productRepo = this.dataSource.getRepository(Product);
    this.imageRepo = this.dataSource.getRepository(ProductImage);
  }

  createProduct(data: Partial<Product>): Product {
    return this.productRepo.create(data);
  }

  async saveProduct(product: Product): Promise<Product> {
    return this.productRepo.save(product);
  }

  async findById(id: string): Promise<Product | null> {
    return this.productRepo.findOne({
      where: { id },
      relations: ['images'],
      order: { images: { displayOrder: 'ASC' } },
    });
  }

  async findByIdWithoutImages(id: string): Promise<Product | null> {
    return this.productRepo.findOneBy({ id });
  }

  // Atomic single-statement increment — avoids the read-modify-write race a
  // load → mutate → save would introduce under concurrent views.
  async incrementViewCount(id: string): Promise<void> {
    await this.productRepo
      .createQueryBuilder()
      .update(Product)
      .set({ viewCount: () => '"viewCount" + 1' })
      .where('id = :id', { id })
      .execute();
  }

  // Backs the tiered "similar products" fallback. `scope` selects the matching
  // strategy; the preview image (displayOrder 0) is joined so cards can render.
  async findSimilar(
    scope: 'subcategory' | 'category' | 'random',
    params: {
      categoryId: string;
      subcategoryId: string;
      excludeIds: string[];
      limit: number;
    },
  ): Promise<Product[]> {
    const { categoryId, subcategoryId, excludeIds, limit } = params;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .select('product.id', 'id')
      .where('product.status IN (:...statuses)', {
        statuses: [ProductStatus.PENDING, ProductStatus.ACTIVE],
      });

    if (excludeIds.length > 0) {
      qb.andWhere('product.id NOT IN (:...excludeIds)', { excludeIds });
    }

    if (scope === 'subcategory') {
      qb.andWhere('product.subcategoryId = :subcategoryId', { subcategoryId });
      qb.orderBy('product.createdAt', 'DESC');
    } else if (scope === 'category') {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
      qb.orderBy('product.createdAt', 'DESC');
    } else {
      // Tiny result set (≤ 5 rows) — RANDOM() ordering cost is irrelevant here.
      qb.orderBy('RANDOM()');
    }

    const rows = await qb.take(limit).getRawMany();
    const ids = rows.map((row) => row.id as string);
    if (ids.length === 0) return [];

    const products = await this.productRepo.find({
      where: { id: In(ids) },
      relations: ['images'],
      order: { images: { displayOrder: 'ASC' } },
    });

    const productsById = new Map(products.map((product) => [product.id, product]));
    return ids.map((id) => productsById.get(id)!).filter(Boolean);
  }

  async deleteProduct(product: Product): Promise<void> {
    await this.productRepo.softRemove(product);
  }

  async findPaginated(
    page: number,
    limit: number,
    filters: ProductFilters,
  ): Promise<[Product[], number]> {
    const qb = this.buildFilterQuery(filters);

    qb.leftJoinAndSelect('product.images', 'images', 'images.displayOrder = 0');

    const sortBy = filters.sortBy ?? 'newest';
    const order = (filters.order ?? 'desc').toUpperCase() as 'ASC' | 'DESC';

    switch (sortBy) {
      case 'price':
        qb.orderBy('product.biddingStartPrice', order);
        qb.addOrderBy('product.createdAt', 'DESC');
        break;
      case 'endingSoon':
        // biddingEndsAt is NULL for PENDING products (no bids yet). Postgres
        // sorts NULLs first on ASC by default, which would float not-yet-started
        // auctions to the top — force NULLS LAST so soonest-ending shows first.
        qb.orderBy('product.biddingEndsAt', 'ASC', 'NULLS LAST');
        qb.addOrderBy('product.createdAt', 'DESC');
        break;
      case 'newest':
      default:
        qb.orderBy('product.createdAt', 'DESC');
        break;
    }

    return qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  async findPaginatedWithOwner(
    page: number,
    limit: number,
    filters: ProductFilters,
  ): Promise<[Product[], number]> {
    const qb = this.buildFilterQuery(filters);

    return qb
      .leftJoinAndSelect('product.images', 'images', 'images.displayOrder = 0')
      .orderBy('product.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  // ─── Image helpers ────────────────────────────────────────────────────────

  createImage(data: Partial<ProductImage>): ProductImage {
    return this.imageRepo.create(data);
  }

  async saveImages(images: ProductImage[]): Promise<ProductImage[]> {
    return this.imageRepo.save(images);
  }

  async findImageById(id: string): Promise<ProductImage | null> {
    return this.imageRepo.findOneBy({ id });
  }

  async findImagesByProductId(productId: string): Promise<ProductImage[]> {
    return this.imageRepo.find({
      where: { productId },
      order: { displayOrder: 'ASC' },
    });
  }

  async deleteImagesByProductId(productId: string): Promise<void> {
    await this.imageRepo.delete({ productId });
  }

  async reorderImages(productId: string, orderedIds: string[]): Promise<void> {
    const images = await this.imageRepo.find({ where: { productId } });

    const existingIds = new Set(images.map((img) => img.id));
    const missing = orderedIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Image(s) not found for this product: ${missing.join(', ')}`,
      );
    }
    if (orderedIds.length !== images.length) {
      throw new BadRequestException(
        `All ${images.length} image(s) must be included in the new order`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(
          ProductImage,
          { id: orderedIds[i] },
          { displayOrder: 1000 + i },
        );
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(
          ProductImage,
          { id: orderedIds[i] },
          { displayOrder: i },
        );
      }
    });
  }

  async setPreviewImage(
    productId: string,
    previewImageId: string,
  ): Promise<void> {
    const images = await this.imageRepo.find({
      where: { productId },
      order: { displayOrder: 'ASC' },
    });

    if (!images.some((img) => img.id === previewImageId)) {
      throw new NotFoundException('Image not found for this product');
    }

    if (images[0]?.id === previewImageId) return;

    const reordered = [
      images.find((img) => img.id === previewImageId)!,
      ...images.filter((img) => img.id !== previewImageId),
    ];

    await this.dataSource.transaction(async (manager) => {
      // Use temp values (1000+) first to avoid the unique (productId, displayOrder) constraint
      for (let i = 0; i < reordered.length; i++) {
        await manager.update(
          ProductImage,
          { id: reordered[i].id },
          { displayOrder: 1000 + i },
        );
      }
      for (let i = 0; i < reordered.length; i++) {
        await manager.update(
          ProductImage,
          { id: reordered[i].id },
          { displayOrder: i },
        );
      }
    });
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private buildFilterQuery(
    filters: ProductFilters,
  ): SelectQueryBuilder<Product> {
    const qb = this.productRepo.createQueryBuilder('product');

    if (filters.statuses && filters.statuses.length > 0) {
      qb.andWhere('product.status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    } else if (filters.status) {
      qb.andWhere('product.status = :status', { status: filters.status });
    }

    if (filters.ownerId) {
      qb.andWhere('product.ownerId = :ownerId', { ownerId: filters.ownerId });
    }

    if (filters.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.subcategoryId) {
      qb.andWhere('product.subcategoryId = :subcategoryId', {
        subcategoryId: filters.subcategoryId,
      });
    }

    if (filters.condition) {
      qb.andWhere('product.condition = :condition', {
        condition: filters.condition,
      });
    }

    if (filters.keyword) {
      qb.andWhere(
        '(LOWER(product.title) LIKE :kw OR LOWER(product.description) LIKE :kw)',
        { kw: `%${filters.keyword.toLowerCase()}%` },
      );
    }

    if (filters.minPrice !== undefined) {
      qb.andWhere('product.biddingStartPrice >= :minPrice', {
        minPrice: filters.minPrice,
      });
    }

    if (filters.maxPrice !== undefined) {
      qb.andWhere('product.biddingStartPrice <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }

    return qb;
  }
}
