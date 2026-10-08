import { SellerTier } from '@common/enums/seller-tier.enum';
import { Product } from '@modules/products/entities/product.entity';
import { ProductPayment } from '@modules/payments/entities/product-payment.entity';
import { RewardsService } from './rewards.service';

describe('RewardsService — tier resolution & commission', () => {
  // Pure functions — no injected dependencies are touched.
  const service = new RewardsService({} as never, {} as never);

  describe('resolveTierAndCommission', () => {
    it.each([
      [0, SellerTier.BRONZE, 20],
      [499, SellerTier.BRONZE, 20],
      [500, SellerTier.BRONZE, 25],
      [1499, SellerTier.BRONZE, 30],
      [1500, SellerTier.SILVER, 35],
      [2999, SellerTier.SILVER, 45],
      [3000, SellerTier.GOLD, 50],
      [6499, SellerTier.GOLD, 60],
      [6500, SellerTier.PLATINUM, 65],
      [12499, SellerTier.PLATINUM, 75],
      [12500, SellerTier.DIAMOND, 80],
      [20000, SellerTier.DIAMOND, 100],
      [50000, SellerTier.DIAMOND, 100],
    ])(
      'sellerPoints=%i -> tier=%s, commission=%i%%',
      (points, expectedTier, expectedCommission) => {
        const { tier, commissionPercent } =
          service.resolveTierAndCommission(points);
        expect(tier).toBe(expectedTier);
        expect(commissionPercent).toBe(expectedCommission);
      },
    );
  });

  describe('calculateCommission (worked example from the agreed spec)', () => {
    it('reproduces basePrice 100 -> biddingStartPrice 120 -> soldPrice 150 -> payout 110', () => {
      const product = { basePrice: 100 } as Product;
      const payment = { amount: 150 } as ProductPayment;

      // Seller has 0 pre-existing points -> Bronze, 20% band.
      const result = service.calculateCommission(product, payment, 0);

      expect(result.profit).toBe(50);
      expect(result.tier).toBe(SellerTier.BRONZE);
      expect(result.commissionPercent).toBe(20);
      expect(result.sellerPayoutAmount).toBe(110);
    });

    it('prices the sale off the CURRENT (pre-this-sale) tier, not a hypothetical post-sale one', () => {
      const product = { basePrice: 100 } as Product;
      const payment = { amount: 150 } as ProductPayment;

      // Seller already has 3000 points (Gold, 50%) BEFORE this sale.
      const result = service.calculateCommission(product, payment, 3000);

      expect(result.commissionPercent).toBe(50);
      expect(result.sellerPayoutAmount).toBe(125); // 100 + 0.5 * 50
    });

    it('Instant Buy profit is always 0.4 x basePrice', () => {
      const basePrice = 100;
      const instantBuyPrice = basePrice * 1.4;
      const product = { basePrice } as Product;
      const payment = { amount: instantBuyPrice } as ProductPayment;

      const result = service.calculateCommission(product, payment, 0);

      expect(result.profit).toBeCloseTo(0.4 * basePrice, 5);
    });
  });
});

describe('RewardsService.listPendingSettlements — delivery stage (A56)', () => {
  it('shows a cancelled courier order as CANCELLED, not IN_TRANSIT', async () => {
    const payment = {
      id: 'pay-1',
      productId: 'product-1',
      product: { id: 'product-1', title: 'Camera', basePrice: 100 },
      sellerId: 'seller-1',
      seller: null,
      winnerUserId: 'buyer-1',
      winner: null,
      referenceLabel: 'REF',
      status: 'SUCCESS',
      amount: 150,
      deliveryCharge: 120,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    };
    const delivery = {
      productPaymentId: 'pay-1',
      receivedAtWarehouseAt: new Date('2026-10-01T00:00:00Z'),
      consignmentId: 'DT-1',
      deliveredAt: null,
      cancelledAt: new Date('2026-10-02T00:00:00Z'),
    };
    const results: Record<string, unknown[]> = {
      ProductPayment: [payment],
      UserRewards: [],
      ProductDelivery: [delivery],
    };
    const dataSource = {
      getRepository: jest.fn((entity: { name: string }) => ({
        find: jest.fn().mockResolvedValue(results[entity.name]),
      })),
    };
    const service = new RewardsService(dataSource as never, {} as never);

    const [row] = await service.listPendingSettlements();

    expect(row.deliveryStage).toBe('CANCELLED');
  });
});
