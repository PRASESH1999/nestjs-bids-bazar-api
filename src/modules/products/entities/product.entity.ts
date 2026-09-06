import { BaseEntity } from '@common/entities/base.entity';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ProductImage } from './product-image.entity';

@Entity('products')
@Index(['status', 'createdAt'])
@Index(['ownerId', 'status'])
@Index(['categoryId', 'subcategoryId'])
export class Product extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  specifications: string | null;

  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @Index()
  @Column({ type: 'uuid' })
  subcategoryId: string;

  @Column({ type: 'enum', enum: ItemCondition })
  condition: ItemCondition;

  @Index()
  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.DRAFT })
  status: ProductStatus;

  // ─── Pricing ─────────────────────────────────────────────────────────────

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  basePrice: number;

  // Stored so the bidding module never has to recompute it.
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  biddingStartPrice: number;

  // Fixed buy-now price = 1.4 × basePrice. Mandatory on every listing.
  // Stored, not recomputed on read, same reasoning as biddingStartPrice.
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  instantBuyPrice: number;

  @Column({ type: 'varchar', length: 10, default: 'NPR' })
  currency: string;

  // Duration of the countdown after the first bid is placed (configurable per product).
  @Column({ type: 'int', default: 72 })
  biddingDurationHours: number;

  // ─── Bidding state (populated by the future Bidding module) ──────────────

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  currentHighestBid: number | null;

  @Column({ type: 'uuid', nullable: true })
  currentHighestBidderId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  biddingStartedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  biddingEndsAt: Date | null;

  // ─── Engagement ───────────────────────────────────────────────────────────

  // Incremented atomically by POST /products/:id/view. Owner and admin views
  // are excluded; only publicly-visible statuses count. No index — there is no
  // view-based sort in current scope (Rule 13).
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  // ─── Rarity ───────────────────────────────────────────────────────────────

  // Self-declared by the seller at create/edit time; admin can override it
  // (in either direction) while approving/rejecting. Just a display badge —
  // no pricing/commission effect.
  @Column({ type: 'boolean', default: false })
  isRare: boolean;

  // ─── Moderation ───────────────────────────────────────────────────────────

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason: string | null;

  // ─── Pickup location ───────────────────────────────────────────────────────
  // Independent per product — never shared/reused across listings, even
  // across multiple products from the same seller. Nullable because existing
  // live rows predate this field; every new/updated product always sets all five.

  @Column({ type: 'varchar', nullable: true })
  province: string | null;

  @Column({ type: 'varchar', nullable: true })
  district: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  street: string | null;

  @Column({ type: 'int', nullable: true })
  wardNumber: number | null;

  // ─── Auction outcome (set by BiddingModule) ──────────────────────────────

  // UUID FK → bids (ON DELETE SET NULL). Enforced at DB level via migration.
  @Column({ type: 'uuid', nullable: true })
  winningBidId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  abandonedAt: Date | null;

  // ─── Audit ────────────────────────────────────────────────────────────────

  @Column({ type: 'timestamptz', nullable: true })
  withdrawnAt: Date | null;

  // ─── Relations ────────────────────────────────────────────────────────────

  @OneToMany(() => ProductImage, (image) => image.product, {
    cascade: true,
    eager: false,
  })
  images: ProductImage[];
}
