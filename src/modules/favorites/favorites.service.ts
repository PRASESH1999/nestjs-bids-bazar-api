import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PUBLICLY_VISIBLE_STATUSES } from '@common/enums/product-status.enum';
import { PaginationDto } from '@common/dto/pagination.dto';
import { PaginatedResult } from '@common/types/paginated-result.type';
import { mapProduct, ProductResponse } from '@modules/products/products.mapper';
import { UsersService } from '@modules/users/users.service';
import { FavoritesRepository } from './favorites.repository';

export interface FavoriteResponse {
  id: string;
  productId: string;
  createdAt: Date;
}

@Injectable()
export class FavoritesService {
  constructor(
    private readonly favoritesRepository: FavoritesRepository,
    private readonly usersService: UsersService,
  ) {}

  async addFavorite(
    userId: string,
    productId: string,
  ): Promise<FavoriteResponse> {
    const product = await this.favoritesRepository.findProductById(productId);
    // Masked as 404 rather than leaking that a non-public product exists —
    // same visibility rule as the product detail page.
    if (!product || !PUBLICLY_VISIBLE_STATUSES.includes(product.status)) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.favoritesRepository.findOne(userId, productId);
    if (existing) {
      throw new ConflictException('Product is already in your favorites');
    }

    // The unique (userId, productId) index is the final backstop against a
    // concurrent double-favorite race — a 23505 from it is mapped to the same
    // 409 by the global exception filter.
    const favorite = this.favoritesRepository.create({ userId, productId });
    const saved = await this.favoritesRepository.save(favorite);

    return {
      id: saved.id,
      productId: saved.productId,
      createdAt: saved.createdAt,
    };
  }

  async removeFavorite(userId: string, productId: string): Promise<void> {
    const removed = await this.favoritesRepository.removeByUserAndProduct(
      userId,
      productId,
    );
    if (!removed) {
      throw new NotFoundException('This product is not in your favorites');
    }
  }

  async listActiveFavorites(
    userId: string,
    query: PaginationDto,
  ): Promise<PaginatedResult<ProductResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [favorites, total] =
      await this.favoritesRepository.findPaginatedActiveForUser(
        userId,
        page,
        limit,
      );

    // Single batch query for every distinct seller across this page — never
    // one lookup per favorited product.
    const sellerSummaries = await this.usersService.getPublicSellerSummaries(
      favorites.map((favorite) => favorite.product.ownerId),
    );

    // Every product here belongs to this user's own favorites by definition —
    // isFavorited is always true, no extra lookup needed.
    const data = favorites.map((favorite) =>
      mapProduct(
        favorite.product,
        true,
        sellerSummaries.get(favorite.product.ownerId) ?? null,
      ),
    );

    return { data, meta: { page, limit, total } };
  }

  /**
   * Which of `productIds` the given user has favorited, as a single batch
   * query. Used by ProductsService to flag `isFavorited` on every product it
   * returns without a per-product lookup. Empty for anonymous requesters.
   */
  async getFavoritedProductIds(
    userId: string | null,
    productIds: string[],
  ): Promise<Set<string>> {
    if (!userId || productIds.length === 0) return new Set();
    const ids = await this.favoritesRepository.findFavoritedProductIds(
      userId,
      productIds,
    );
    return new Set(ids);
  }
}
