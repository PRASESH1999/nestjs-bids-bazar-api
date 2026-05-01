import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { ProductStatus } from '@common/enums/product-status.enum';
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

  // ─── Moderation ───────────────────────────────────────────────────────────

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason: string | null;

  // ─── Location (forward compat, nullable) ─────────────────────────────────

  @Column({ type: 'varchar', nullable: true })
  locationProvince: string | null;

  @Column({ type: 'varchar', nullable: true })
  locationDistrict: string | null;

  @Column({ type: 'varchar', nullable: true })
  locationArea: string | null;

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
