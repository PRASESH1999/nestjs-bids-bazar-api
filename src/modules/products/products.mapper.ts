import { Product } from './entities/product.entity';

export type ProductImageResponse = {
  id: string;
  displayOrder: number;
  mimeType: string;
  url: string;
};

// Public seller summary attached to every product response. `averageRating`/
// `ratingCount` are persisted on User, recomputed from seller_ratings on
// every new rating — see RatingsRepository.createAndRecomputeAggregate.
// `totalListings`/`totalSold` are computed live from the products table
// (never stored) — see UsersRepository.countListingsAndSalesBySeller.
export type ProductSellerSummary = {
  id: string;
  username: string;
  averageRating: number;
  ratingCount: number;
  totalListings: number;
  totalSold: number;
};

// `viewCount` is omitted from the base response — it is detail-page metadata,
// surfaced explicitly on ProductDetailResponse rather than on every list item.
export type ProductResponse = Omit<Product, 'images' | 'viewCount'> & {
  previewImage: { id: string; url: string; mimeType: string } | null;
  images: ProductImageResponse[];
  // Derived, not stored: currentBid < instantBuyPrice. See Rule 13/14.
  showInstantBuy: boolean;
  // Whether the requesting user has this product in their favorites. Always
  // false for unauthenticated requests. Computed by the caller via a single
  // batch favorites lookup — never a per-product query (see FavoritesService).
  isFavorited: boolean;
  // Null only if the owning account no longer resolves (e.g. soft-deleted).
  seller: ProductSellerSummary | null;
};

// Plain, dependency-free mapping shared by ProductsService and FavoritesService.
// Kept out of ProductsService so FavoritesModule can reuse it without importing
// ProductsModule (which itself imports FavoritesModule to compute isFavorited —
// importing the other way would create a circular module dependency).
export function mapProduct(
  product: Product,
  isFavorited: boolean,
  seller: ProductSellerSummary | null,
): ProductResponse {
  const currentBid = product.currentHighestBid ?? product.biddingStartPrice;
  return {
    id: product.id,
    ownerId: product.ownerId,
    title: product.title,
    description: product.description,
    specifications: product.specifications,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId,
    condition: product.condition,
    status: product.status,
    basePrice: product.basePrice,
    biddingStartPrice: product.biddingStartPrice,
    instantBuyPrice: product.instantBuyPrice,
    showInstantBuy: currentBid < product.instantBuyPrice,
    currency: product.currency,
    biddingDurationHours: product.biddingDurationHours,
    currentHighestBid: product.currentHighestBid,
    currentHighestBidderId: product.currentHighestBidderId,
    biddingStartedAt: product.biddingStartedAt,
    biddingEndsAt: product.biddingEndsAt,
    submittedAt: product.submittedAt,
    reviewedById: product.reviewedById,
    reviewedAt: product.reviewedAt,
    rejectionReason: product.rejectionReason,
    province: product.province,
    district: product.district,
    city: product.city,
    street: product.street,
    wardNumber: product.wardNumber,
    winningBidId: product.winningBidId,
    closedAt: product.closedAt,
    settledAt: product.settledAt,
    abandonedAt: product.abandonedAt,
    withdrawnAt: product.withdrawnAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    deletedAt: product.deletedAt,
    isFavorited,
    seller,
    previewImage: (() => {
      const p = product.images?.find((img) => img.displayOrder === 0);
      return p
        ? {
            id: p.id,
            url: `/api/v1/products/${product.id}/images/${p.id}`,
            mimeType: p.mimeType,
          }
        : null;
    })(),
    images:
      product.images?.map((img) => ({
        id: img.id,
        displayOrder: img.displayOrder,
        mimeType: img.mimeType,
        url: `/api/v1/products/${product.id}/images/${img.id}`,
      })) || [],
  };
}
