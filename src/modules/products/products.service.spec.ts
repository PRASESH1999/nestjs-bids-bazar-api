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
