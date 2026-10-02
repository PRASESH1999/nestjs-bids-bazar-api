import { SellerTier } from '@common/enums/seller-tier.enum';

/**
 * A seller's public profile — `GET /sellers/:id`.
 *
 * Every field here was already computed somewhere; none of it was reachable
 * without a product in hand. The rating aggregate is stored on `User` and
 * recomputed on each new rating, and the listing/sale counts come from
 * `UsersRepository.countListingsAndSalesBySeller` — both of which only ever
 * left the building attached to a product response, as `product.seller`. A
 * profile page has no product, which is what made this endpoint necessary.
 * See OPEN-ITEMS A32.
 *
 * What is deliberately **not** on here, and must not be added:
 *
 * - **email, phone, `pendingPhone`** — private to the account holder. They are
 *   on `/users/me` and `/users/:id` because those are authenticated and scoped;
 *   this one is `@Public()` and anybody may call it with any id.
 * - **`fullName`, the KYC document, its number and its images** — a verified
 *   identity attribute is not a public one. `isIdentityVerified` is the badge,
 *   and it is a boolean precisely so the name behind it stays put.
 * - **`isActive`, `role`** — moderation state, for the staff reads.
 */
export interface SellerProfileResponse {
  id: string;
  /** The public identity everywhere — system-generated and stable. */
  username: string;
  /**
   * 0 when `ratingCount` is 0. A client must render that as "no ratings yet"
   * rather than as zero stars, which would libel an unrated seller.
   */
  averageRating: number;
  ratingCount: number;
  totalListings: number;
  totalSold: number;
  /** "Member since" — the one trust signal a new account cannot manufacture. */
  createdAt: Date;
  /** Whether an APPROVED KYC exists. A boolean, and only ever a boolean. */
  isIdentityVerified: boolean;
  /** Sets the seller's commission band, so it is already public-facing. */
  sellerTier: SellerTier;
  /**
   * How many ratings gave each star, keyed '1'–'5', every bucket present.
   *
   * Computed here rather than client-side because `/sellers/:id/ratings` is
   * paginated: a client counting a page of ten would render a histogram of the
   * last ten reviews and present it as the seller's whole record.
   */
  ratingBreakdown: Record<string, number>;
}
