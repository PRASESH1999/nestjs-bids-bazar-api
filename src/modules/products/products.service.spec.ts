import { ItemCondition } from '@common/enums/item-condition.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { Product } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

describe('ProductsService — Instant Buy pricing', () => {
  // Pure functions — no injected dependencies are touched, so a full
  // NestJS TestingModule is unnecessary here.
  const service = new ProductsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
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
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
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
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
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
