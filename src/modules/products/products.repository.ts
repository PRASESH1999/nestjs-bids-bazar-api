import { Injectable } from '@nestjs/common';
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

    return qb
      .leftJoinAndSelect('product.images', 'images', 'images.displayOrder = 0')
      .orderBy('product.createdAt', 'DESC')
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

    return qb;
  }
}
