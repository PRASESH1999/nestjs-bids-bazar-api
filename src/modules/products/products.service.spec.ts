import { ItemCondition } from '@common/enums/item-condition.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { Product } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

// Shared across the describe blocks below — none of them exercise favorites
// or seller-rating logic itself (see favorites.service.spec.ts and
// ratings.service.spec.ts for that), they just need mapProduct's isFavorited/
// seller lookups to resolve to something.
const mockFavoritesService = {
  getFavoritedProductIds: jest.fn().mockResolvedValue(new Set<string>()),
};

const mockUsersService = {
  getPublicSellerSummaries: jest.fn().mockResolvedValue(new Map()),
};

describe('ProductsService — Instant Buy pricing', () => {
  // Pure functions — no injected dependencies are touched, so a full
  // NestJS TestingModule is unnecessary here.
  const service = new ProductsService(
    {} as never,
    {} as never,
    {} as never,
    mockUsersService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    mockFavoritesService as never,
  );

  describe('computeInstantBuyPrice', () => {
    it('is 1.4x basePrice', () => {
      expect(service.computeInstantBuyPrice(100)).toBe(140);
      expect(service.computeInstantBuyPrice(20000)).toBe(28000);
    });

    it('is always above computeBiddingStartPrice at every markup band', () => {
      const basePrices = [5000, 15000, 25000, 35000, 45000, 60000];
      for (const basePrice of basePrices) {
        const instantBuyPrice = service.computeInstantBuyPrice(basePrice);
        const biddingStartPrice = service.computeBiddingStartPrice(basePrice);
        expect(instantBuyPrice).toBeGreaterThan(biddingStartPrice);
      }
    });

    it('rounds to 2 decimal places', () => {
      expect(service.computeInstantBuyPrice(33.335)).toBe(46.67);
    });
  });

  describe('showInstantBuy visibility (boundary cases)', () => {
    const instantBuyPrice = 140;
    const showInstantBuy = (currentBid: number) => currentBid < instantBuyPrice;

    it('shows while current bid is below instantBuyPrice', () => {
      expect(showInstantBuy(100)).toBe(true);
      expect(showInstantBuy(139.99)).toBe(true);
    });

    it('hides once current bid meets instantBuyPrice', () => {
      expect(showInstantBuy(140)).toBe(false);
    });

    it('hides once current bid exceeds instantBuyPrice', () => {
      expect(showInstantBuy(150)).toBe(false);
    });
  });
});

describe('ProductsService.updateProduct — pickup location', () => {
  function buildExistingProduct(): Product {
    return {
      id: 'product-1',
      ownerId: 'user-1',
      title: 'Original title',
      description: 'Original description text that is long enough.',
      specifications: null,
      categoryId: 'cat-1',
      subcategoryId: 'sub-1',
      condition: ItemCondition.NEW,
      status: ProductStatus.DRAFT,
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
      isRare: false,
      submittedAt: null,
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      province: 'Old Province',
      district: 'Old District',
      city: 'Old City',
      street: 'Old Street',
      wardNumber: 1,
      winningBidId: null,
      closedAt: null,
      settledAt: null,
      abandonedAt: null,
      withdrawnAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      images: [],
    };
  }

  it('updates only the location fields, leaving title/description/price untouched', async () => {
    const existingProduct = buildExistingProduct();

    const productsRepository = {
      findByIdWithoutImages: jest.fn().mockResolvedValue(existingProduct),
      saveProduct: jest.fn().mockResolvedValue(existingProduct),
      findById: jest.fn().mockResolvedValue(existingProduct),
    } as unknown as ProductsRepository;

    const service = new ProductsService(
      productsRepository,
      {} as never,
      {} as never,
      mockUsersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mockFavoritesService as never,
    );

    const dto: UpdateProductDto = {
      province: 'New Province',
      district: 'New District',
      city: 'New City',
      street: 'New Street',
      wardNumber: 9,
    };

    const result = await service.updateProduct('user-1', 'product-1', dto);

    expect(result.province).toBe('New Province');
    expect(result.district).toBe('New District');
    expect(result.city).toBe('New City');
    expect(result.street).toBe('New Street');
    expect(result.wardNumber).toBe(9);

    // Everything else is untouched by a location-only update.
    expect(result.title).toBe('Original title');
    expect(result.description).toBe(
      'Original description text that is long enough.',
    );
    expect(result.basePrice).toBe(1000);
    expect(result.biddingStartPrice).toBe(1200);
    expect(result.instantBuyPrice).toBe(1400);
    expect(result.condition).toBe(ItemCondition.NEW);
  });

  it('updates only title/description without touching existing location fields', async () => {
    const existingProduct = buildExistingProduct();

    const productsRepository = {
      findByIdWithoutImages: jest.fn().mockResolvedValue(existingProduct),
      saveProduct: jest.fn().mockResolvedValue(existingProduct),
      findById: jest.fn().mockResolvedValue(existingProduct),
    } as unknown as ProductsRepository;

    const service = new ProductsService(
      productsRepository,
      {} as never,
      {} as never,
      mockUsersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mockFavoritesService as never,
    );

    const dto: UpdateProductDto = { title: 'Updated title' };

    const result = await service.updateProduct('user-1', 'product-1', dto);

    expect(result.title).toBe('Updated title');
    expect(result.province).toBe('Old Province');
    expect(result.district).toBe('Old District');
    expect(result.city).toBe('Old City');
    expect(result.street).toBe('Old Street');
    expect(result.wardNumber).toBe(1);
  });
});

describe('ProductsService — isFavorited flag', () => {
  function buildProduct(id: string): Product {
    return {
      id,
      ownerId: 'seller-1',
      title: `Product ${id}`,
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
      isRare: false,
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
    };
  }

  it('flags isFavorited per product from a single batch lookup, not one query each', async () => {
    const productA = buildProduct('product-a');
    const productB = buildProduct('product-b');

    const productsRepository = {
      findPaginated: jest.fn().mockResolvedValue([[productA, productB], 2]),
    } as unknown as ProductsRepository;

    const favoritesService = {
      // Only product-a is favorited by this requester.
      getFavoritedProductIds: jest
        .fn()
        .mockResolvedValue(new Set(['product-a'])),
    };

    const service = new ProductsService(
      productsRepository,
      {} as never,
      {} as never,
      mockUsersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      favoritesService as never,
    );

    const result = await service.listPublicProducts({}, 'user-1');

    expect(favoritesService.getFavoritedProductIds).toHaveBeenCalledTimes(1);
    expect(favoritesService.getFavoritedProductIds).toHaveBeenCalledWith(
      'user-1',
      ['product-a', 'product-b'],
    );
    expect(result.data.find((p) => p.id === 'product-a')?.isFavorited).toBe(
      true,
    );
    expect(result.data.find((p) => p.id === 'product-b')?.isFavorited).toBe(
      false,
    );
  });

  it('is false for every product on an unauthenticated (anonymous) request', async () => {
    const productA = buildProduct('product-a');

    const productsRepository = {
      findPaginated: jest.fn().mockResolvedValue([[productA], 1]),
    } as unknown as ProductsRepository;

    const favoritesService = {
      getFavoritedProductIds: jest.fn().mockResolvedValue(new Set<string>()),
    };

    const service = new ProductsService(
      productsRepository,
      {} as never,
      {} as never,
      mockUsersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      favoritesService as never,
    );

    const result = await service.listPublicProducts({}, null);

    expect(result.data[0].isFavorited).toBe(false);
  });
});

describe('ProductsService — seller rating summary', () => {
  function buildProduct(id: string, ownerId: string): Product {
    return {
      id,
      ownerId,
      title: `Product ${id}`,
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
      isRare: false,
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
    };
  }

  it("attaches each product's seller summary from a single batch lookup, not one query each", async () => {
    const productA = buildProduct('product-a', 'seller-1');
    const productB = buildProduct('product-b', 'seller-2');

    const productsRepository = {
      findPaginated: jest.fn().mockResolvedValue([[productA, productB], 2]),
    } as unknown as ProductsRepository;

    const usersService = {
      getPublicSellerSummaries: jest.fn().mockResolvedValue(
        new Map([
          [
            'seller-1',
            {
              id: 'seller-1',
              username: 'BB000001-2026',
              averageRating: 4.5,
              ratingCount: 10,
              totalListings: 7,
              totalSold: 3,
            },
          ],
        ]),
      ),
    };

    const service = new ProductsService(
      productsRepository,
      {} as never,
      {} as never,
      usersService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mockFavoritesService as never,
    );

    const result = await service.listPublicProducts({}, null);

    expect(usersService.getPublicSellerSummaries).toHaveBeenCalledTimes(1);
    expect(usersService.getPublicSellerSummaries).toHaveBeenCalledWith([
      'seller-1',
      'seller-2',
    ]);
    expect(result.data.find((p) => p.id === 'product-a')?.seller).toEqual({
      id: 'seller-1',
      username: 'BB000001-2026',
      averageRating: 4.5,
      ratingCount: 10,
      totalListings: 7,
      totalSold: 3,
    });
    expect(result.data.find((p) => p.id === 'product-b')?.seller).toBeNull();
  });
});
