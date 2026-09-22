import { ProductStatus } from '@common/enums/product-status.enum';
import { Product } from './entities/product.entity';

/**
 * The exact set of fields `POST /products/:id/submit` requires, as a list
 * rather than an exception.
 *
 * This is the single definition of "ready to submit". `assertReadyForSubmission`
 * throws off it, and it is also published on the owner's own listings as
 * `missingSubmissionFields` so a client can disable a Submit button and name
 * what is still needed **without** re-implementing the rule. Before this,
 * the frontend kept a hand-maintained copy that had to be edited in lockstep
 * with this function. See OPEN-ITEMS A20.
 */
export function computeMissingSubmissionFields(
  product: Product,
  // `null` means "the images relation was not loaded", which is not the same as
  // "this product has no images". Passing 0 for an unloaded relation would
  // report `images` as missing on a listing that has eight of them.
  imageCount: number | null,
): string[] {
  const missing: string[] = [];

  if (!product.title || product.title.trim().length < 5) missing.push('title');
  if (!product.description || product.description.trim().length < 20)
    missing.push('description');
  if (!product.categoryId) missing.push('categoryId');
  if (!product.subcategoryId) missing.push('subcategoryId');
  if (!product.condition) missing.push('condition');
  if (product.basePrice == null || Number(product.basePrice) <= 0)
    missing.push('basePrice');
  if (!product.province) missing.push('province');
  if (!product.district) missing.push('district');
  if (!product.city) missing.push('city');
  if (!product.street) missing.push('street');
  if (!product.wardNumber) missing.push('wardNumber');
  if (imageCount !== null) {
    if (imageCount === 0) missing.push('images');
    if (imageCount > 8) missing.push('images (max 8)');
  }

  return missing;
}

// Only these statuses can be submitted, so only these carry a meaningful
// readiness list. Everything else reports null rather than an empty array, so
// "nothing missing" and "not applicable" stay distinguishable.
const SUBMITTABLE_STATUSES: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.REJECTED,
];

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
  // What still has to be filled in before this listing can be submitted for
  // review. Empty array = ready. Null on any status where submission is not
  // the next step. See computeMissingSubmissionFields.
  missingSubmissionFields: string[] | null;
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
  // Both sides can be null on an in-progress DRAFT that hasn't set a price
  // yet — showInstantBuy is simply false until then.
  const currentBid =
    product.currentHighestBid ?? product.biddingStartPrice ?? 0;
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
    biddingEndPrice: product.biddingEndPrice,
    showInstantBuy:
      product.instantBuyPrice != null && currentBid < product.instantBuyPrice,
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
    settledAmount: product.settledAmount,
    abandonedAt: product.abandonedAt,
    withdrawnAt: product.withdrawnAt,
    isRare: product.isRare,
    missingSubmissionFields: SUBMITTABLE_STATUSES.includes(product.status)
      ? computeMissingSubmissionFields(
          product,
          // Array.isArray, not `?.length ?? 0` — an unloaded relation is
          // undefined and must stay distinguishable from an empty one.
          Array.isArray(product.images) ? product.images.length : null,
        )
      : null,
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
