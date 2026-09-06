import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { DeliveryZone } from '@common/enums/delivery-zone.enum';
import { Payment } from '@modules/payments/entities/payment.entity';
import { Product } from '@modules/products/entities/product.entity';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { SellerRating } from './entities/seller-rating.entity';
import { RatingsRepository } from './ratings.repository';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';

const mockRatingsRepository = {
  findPaymentWithProduct: jest.fn(),
  findByPaymentId: jest.fn(),
  createAndRecomputeAggregate: jest.fn(),
  findPaginatedForSeller: jest.fn(),
  findRatedPaymentIds: jest.fn(),
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
    status: ProductStatus.SETTLED,
    basePrice: 1000,
    biddingStartPrice: 1200,
    instantBuyPrice: 1400,
    currency: 'NPR',
    biddingDurationHours: 72,
    currentHighestBid: 1300,
    currentHighestBidderId: 'buyer-1',
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
    winningBidId: 'bid-1',
    closedAt: new Date(),
    settledAt: new Date(),
    abandonedAt: null,
    withdrawnAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    images: [],
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    productId: 'product-1',
    product: makeProduct(),
    winnerUserId: 'buyer-1',
    amount: 1300,
    referenceLabel: 'REF123',
    terminalId: 'TERM1',
    qrString: null,
    qrMessage: null,
    websocketUrl: null,
    status: PaymentStatus.SUCCESS,
    fonepayTraceId: null,
    paymentMessage: null,
    paymentDeadline: new Date(),
    deliveryZone: DeliveryZone.INSIDE_VALLEY,
    deliveryCharge: 100,
    sellerPaidAt: null,
    sellerPaidById: null,
    sellerPayoutAmount: null,
    sellerCommissionPercent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Payment;
}

function makeRating(overrides: Partial<SellerRating> = {}): SellerRating {
  return {
    id: 'rating-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    paymentId: 'payment-1',
    rating: 5,
    remarks: 'Great seller!',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    buyer: { username: 'BB000001-2026' },
    ...overrides,
  } as unknown as SellerRating;
}

describe('RatingsService', () => {
  let service: RatingsService;

  beforeEach(() => {
    service = new RatingsService(
      mockRatingsRepository as unknown as RatingsRepository,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('rateSeller', () => {
    it('creates a rating for the buyer on a SUCCESS payment', async () => {
      mockRatingsRepository.findPaymentWithProduct.mockResolvedValue(
        makePayment(),
      );
      mockRatingsRepository.findByPaymentId.mockResolvedValue(null);
      const created = makeRating();
      mockRatingsRepository.createAndRecomputeAggregate.mockResolvedValue(
        created,
      );

      const result = await service.rateSeller(
        'buyer-1',
        'payment-1',
        5,
        'Great seller!',
      );

      expect(
        mockRatingsRepository.createAndRecomputeAggregate,
      ).toHaveBeenCalledWith({
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        paymentId: 'payment-1',
        rating: 5,
        remarks: 'Great seller!',
      });
      expect(result.id).toBe('rating-1');
      expect(result.rating).toBe(5);
    });

    it('throws NotFoundException when the payment does not exist', async () => {
      mockRatingsRepository.findPaymentWithProduct.mockResolvedValue(null);

      await expect(
        service.rateSeller('buyer-1', 'missing-payment', 5),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the buyer on the payment', async () => {
      mockRatingsRepository.findPaymentWithProduct.mockResolvedValue(
        makePayment({ winnerUserId: 'someone-else' }),
      );

      await expect(
        service.rateSeller('buyer-1', 'payment-1', 5),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the transaction is not yet complete (payment not SUCCESS)', async () => {
      mockRatingsRepository.findPaymentWithProduct.mockResolvedValue(
        makePayment({ status: PaymentStatus.PENDING }),
      );

      await expect(
        service.rateSeller('buyer-1', 'payment-1', 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when this payment has already been rated', async () => {
      mockRatingsRepository.findPaymentWithProduct.mockResolvedValue(
        makePayment(),
      );
      mockRatingsRepository.findByPaymentId.mockResolvedValue(makeRating());

      await expect(
        service.rateSeller('buyer-1', 'payment-1', 5),
      ).rejects.toThrow(ConflictException);
      expect(
        mockRatingsRepository.createAndRecomputeAggregate,
      ).not.toHaveBeenCalled();
    });

    it('allows the same buyer to rate the same seller again via a separate payment', async () => {
      const paymentsById: Record<string, Payment> = {
        'payment-1': makePayment({ id: 'payment-1' }),
        'payment-2': makePayment({
          id: 'payment-2',
          product: makeProduct({ id: 'product-2', ownerId: 'seller-1' }),
        }),
      };
      mockRatingsRepository.findPaymentWithProduct.mockImplementation(
        (paymentId: string) => Promise.resolve(paymentsById[paymentId] ?? null),
      );
      mockRatingsRepository.findByPaymentId.mockResolvedValue(null);
      mockRatingsRepository.createAndRecomputeAggregate.mockImplementation(
        (data: { paymentId: string }) =>
          Promise.resolve(
            makeRating({
              id: data.paymentId === 'payment-1' ? 'rating-1' : 'rating-2',
              paymentId: data.paymentId,
            }),
          ),
      );

      const first = await service.rateSeller('buyer-1', 'payment-1', 5);
      const second = await service.rateSeller('buyer-1', 'payment-2', 4);

      expect(first.id).toBe('rating-1');
      expect(second.id).toBe('rating-2');
      expect(
        mockRatingsRepository.createAndRecomputeAggregate,
      ).toHaveBeenCalledTimes(2);
      // Same buyer, same seller, but two distinct payments — never blocked.
      expect(
        (
          mockRatingsRepository.createAndRecomputeAggregate.mock.calls as Array<
            [{ sellerId: string }]
          >
        )[0][0].sellerId,
      ).toBe('seller-1');
      expect(
        (
          mockRatingsRepository.createAndRecomputeAggregate.mock.calls as Array<
            [{ sellerId: string }]
          >
        )[1][0].sellerId,
      ).toBe('seller-1');
    });
  });

  describe('listSellerRatings', () => {
    it('maps paginated ratings with the buyer username only', async () => {
      mockRatingsRepository.findPaginatedForSeller.mockResolvedValue([
        [makeRating()],
        1,
      ]);

      const result = await service.listSellerRatings('seller-1', 1, 20);

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
      expect(result.data[0].createdAt).toBeInstanceOf(Date);
      expect(result.data[0]).toMatchObject({
        id: 'rating-1',
        rating: 5,
        remarks: 'Great seller!',
        buyer: { username: 'BB000001-2026' },
      });
    });
  });

  describe('getRatedPaymentIds', () => {
    it('returns an empty set when there are no payment ids to check', async () => {
      const result = await service.getRatedPaymentIds([]);
      expect(result.size).toBe(0);
      expect(mockRatingsRepository.findRatedPaymentIds).not.toHaveBeenCalled();
    });

    it('performs a single batch lookup and returns the matched ids as a set', async () => {
      mockRatingsRepository.findRatedPaymentIds.mockResolvedValue([
        'payment-1',
      ]);

      const result = await service.getRatedPaymentIds([
        'payment-1',
        'payment-2',
      ]);

      expect(mockRatingsRepository.findRatedPaymentIds).toHaveBeenCalledTimes(
        1,
      );
      expect(result.has('payment-1')).toBe(true);
      expect(result.has('payment-2')).toBe(false);
    });
  });
});

describe('RatingsController — immutability', () => {
  it('exposes only rateSeller (POST) and listSellerRatings (GET) — no edit or delete route', () => {
    const methodNames = Object.getOwnPropertyNames(
      RatingsController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(methodNames.sort()).toEqual(
      ['listSellerRatings', 'rateSeller'].sort(),
    );
  });
});
