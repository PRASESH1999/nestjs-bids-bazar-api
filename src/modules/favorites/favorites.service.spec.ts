import { ConflictException, NotFoundException } from '@nestjs/common';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { Favorite } from './entities/favorite.entity';
import { FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';

const mockFavoritesRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  removeByUserAndProduct: jest.fn(),
  findProductById: jest.fn(),
  findFavoritedProductIds: jest.fn(),
  findPaginatedActiveForUser: jest.fn(),
};

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    ownerId: 'seller-1',
    title: 'Test product',
    description: 'A product long enough to pass validation.',
    specifications: null,
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    condition: ItemCondition.NEW,
    status: ProductStatus.ACTIVE,
    basePrice: 1000,
    biddingStartPrice: 1200,
    instantBuyPrice: 1400,
    currency: 'NPR',
    biddingDurationHours: 72,
    currentHighestBid: null,
    currentHighestBidderId: null,
    biddingStartedAt: null,
    biddingEndsAt: null,
    viewCount: 0,
    submittedAt: null,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    province: null,
    district: null,
    city: null,
    street: null,
    wardNumber: null,
    winningBidId: null,
    closedAt: null,
    settledAt: null,
    abandonedAt: null,
    withdrawnAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    images: [],
    ...overrides,
  };
}

function makeFavorite(overrides: Partial<Favorite> = {}): Favorite {
  return {
    id: 'favorite-1',
    userId: 'user-1',
    productId: 'product-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Favorite;
}

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(() => {
    service = new FavoritesService(
      mockFavoritesRepository as unknown as FavoritesRepository,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('addFavorite', () => {
    it('creates a favorite for a publicly visible product', async () => {
      mockFavoritesRepository.findProductById.mockResolvedValue(
        makeProduct({ status: ProductStatus.ACTIVE }),
      );
      mockFavoritesRepository.findOne.mockResolvedValue(null);
      const created = makeFavorite();
      mockFavoritesRepository.create.mockReturnValue(created);
      mockFavoritesRepository.save.mockResolvedValue(created);

      const result = await service.addFavorite('user-1', 'product-1');

      expect(mockFavoritesRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        productId: 'product-1',
      });
      expect(result).toEqual({
        id: created.id,
        productId: created.productId,
        createdAt: created.createdAt,
      });
    });

    it('throws NotFoundException when the product does not exist', async () => {
      mockFavoritesRepository.findProductById.mockResolvedValue(null);

      await expect(
        service.addFavorite('user-1', 'missing-product'),
      ).rejects.toThrow(NotFoundException);
      expect(mockFavoritesRepository.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the product is not publicly visible (e.g. still DRAFT)', async () => {
      mockFavoritesRepository.findProductById.mockResolvedValue(
        makeProduct({ status: ProductStatus.DRAFT }),
      );

      await expect(service.addFavorite('user-1', 'product-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException — not a duplicate row — when already favorited', async () => {
      mockFavoritesRepository.findProductById.mockResolvedValue(
        makeProduct({ status: ProductStatus.ACTIVE }),
      );
      mockFavoritesRepository.findOne.mockResolvedValue(makeFavorite());

      await expect(service.addFavorite('user-1', 'product-1')).rejects.toThrow(
        ConflictException,
      );
      expect(mockFavoritesRepository.create).not.toHaveBeenCalled();
      expect(mockFavoritesRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeFavorite', () => {
    it('resolves when a row was actually removed', async () => {
      mockFavoritesRepository.removeByUserAndProduct.mockResolvedValue(true);

      await expect(
        service.removeFavorite('user-1', 'product-1'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the product was not favorited', async () => {
      mockFavoritesRepository.removeByUserAndProduct.mockResolvedValue(false);

      await expect(
        service.removeFavorite('user-1', 'product-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listActiveFavorites', () => {
    it('maps each favorited product with isFavorited always true', async () => {
      const product = makeProduct({ id: 'product-2' });
      mockFavoritesRepository.findPaginatedActiveForUser.mockResolvedValue([
        [makeFavorite({ productId: 'product-2', product })],
        1,
      ]);

      const result = await service.listActiveFavorites('user-1', {
        page: 1,
        limit: 20,
      });

      expect(
        mockFavoritesRepository.findPaginatedActiveForUser,
      ).toHaveBeenCalledWith('user-1', 1, 20);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('product-2');
      expect(result.data[0].isFavorited).toBe(true);
    });

    it('defaults page/limit when not provided', async () => {
      mockFavoritesRepository.findPaginatedActiveForUser.mockResolvedValue([
        [],
        0,
      ]);

      await service.listActiveFavorites('user-1', {});

      expect(
        mockFavoritesRepository.findPaginatedActiveForUser,
      ).toHaveBeenCalledWith('user-1', 1, 20);
    });
  });

  describe('getFavoritedProductIds', () => {
    it('returns an empty set for an anonymous (null) requester without querying', async () => {
      const result = await service.getFavoritedProductIds(null, ['product-1']);

      expect(result.size).toBe(0);
      expect(
        mockFavoritesRepository.findFavoritedProductIds,
      ).not.toHaveBeenCalled();
    });

    it('returns an empty set when there are no product ids to check', async () => {
      const result = await service.getFavoritedProductIds('user-1', []);

      expect(result.size).toBe(0);
      expect(
        mockFavoritesRepository.findFavoritedProductIds,
      ).not.toHaveBeenCalled();
    });

    it('performs a single batch lookup and returns the matched ids as a set', async () => {
      mockFavoritesRepository.findFavoritedProductIds.mockResolvedValue([
        'product-1',
        'product-3',
      ]);

      const result = await service.getFavoritedProductIds('user-1', [
        'product-1',
        'product-2',
        'product-3',
      ]);

      expect(
        mockFavoritesRepository.findFavoritedProductIds,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockFavoritesRepository.findFavoritedProductIds,
      ).toHaveBeenCalledWith('user-1', ['product-1', 'product-2', 'product-3']);
      expect(result.has('product-1')).toBe(true);
      expect(result.has('product-2')).toBe(false);
      expect(result.has('product-3')).toBe(true);
    });
  });
});
