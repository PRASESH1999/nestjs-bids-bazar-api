import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
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
  priceSort?: 'asc' | 'desc';
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

    if (filters.priceSort) {
      qb.orderBy('product.basePrice', filters.priceSort.toUpperCase() as 'ASC' | 'DESC');
    } else {
      qb.orderBy('product.createdAt', 'DESC');
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
      throw new NotFoundException(`Image(s) not found for this product: ${missing.join(', ')}`);
    }
    if (orderedIds.length !== images.length) {
      throw new BadRequestException(`All ${images.length} image(s) must be included in the new order`);
    }

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(ProductImage, { id: orderedIds[i] }, { displayOrder: 1000 + i });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(ProductImage, { id: orderedIds[i] }, { displayOrder: i });
      }
    });
  }

  async setPreviewImage(productId: string, previewImageId: string): Promise<void> {
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
        await manager.update(ProductImage, { id: reordered[i].id }, { displayOrder: 1000 + i });
      }
      for (let i = 0; i < reordered.length; i++) {
        await manager.update(ProductImage, { id: reordered[i].id }, { displayOrder: i });
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
      qb.andWhere('product.basePrice >= :minPrice', { minPrice: filters.minPrice });
    }

    if (filters.maxPrice !== undefined) {
      qb.andWhere('product.basePrice <= :maxPrice', { maxPrice: filters.maxPrice });
    }

    return qb;
  }
}
