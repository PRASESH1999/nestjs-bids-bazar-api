import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { ACTIVE_LISTING_STATUSES } from '@common/enums/product-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesRepository {
  private readonly repo: Repository<Favorite>;
  private readonly productRepo: Repository<Product>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(Favorite);
    this.productRepo = this.dataSource.getRepository(Product);
  }

  async findOne(userId: string, productId: string): Promise<Favorite | null> {
    return this.repo.findOneBy({ userId, productId });
  }

  create(data: Partial<Favorite>): Favorite {
    return this.repo.create(data);
  }

  async save(favorite: Favorite): Promise<Favorite> {
    return this.repo.save(favorite);
  }

  // Hard-deletes the row — favorites are removed outright on unfavorite, never
  // soft-deleted (there's no scenario where a removed favorite is restored).
  // Returns true only if a row was actually removed.
  async removeByUserAndProduct(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    const result = await this.repo.delete({ userId, productId });
    return (result.affected ?? 0) > 0;
  }

  async findProductById(productId: string): Promise<Product | null> {
    return this.productRepo.findOneBy({ id: productId });
  }

  // Single IN query for the whole batch — never one lookup per product.
  async findFavoritedProductIds(
    userId: string,
    productIds: string[],
  ): Promise<string[]> {
    const rows = await this.repo.find({
      where: { userId, productId: In(productIds) },
      select: { productId: true },
    });
    return rows.map((row) => row.productId);
  }

  // Favorited products that are still live listings (see ACTIVE_LISTING_STATUSES),
  // most recently favorited first. The row itself is never filtered out of the
  // table by product state — only from this particular view.
  async findPaginatedActiveForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<[Favorite[], number]> {
    return this.repo
      .createQueryBuilder('favorite')
      .innerJoinAndSelect('favorite.product', 'product')
      .leftJoinAndSelect('product.images', 'images', 'images.displayOrder = 0')
      .where('favorite.userId = :userId', { userId })
      .andWhere('product.status IN (:...statuses)', {
        statuses: ACTIVE_LISTING_STATUSES,
      })
      .andWhere('product.deletedAt IS NULL')
      .orderBy('favorite.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }
}
