import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { BidPaymentStatus } from '@common/enums/bid-payment-status.enum';
import { PaymentConfirmationMethod } from '@common/enums/payment-confirmation-method.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('bids')
// (productId, amount) composite index — used for finding the highest bid per product
@Index(['productId', 'amount'])
// (bidderId, placedAt) composite index — used for "my bids" queries ordered by time
@Index(['bidderId', 'placedAt'])
// (paymentStatus, paymentDeadline) — optimises cron queries for overdue payment windows (Phase 2)
@Index(['paymentStatus', 'paymentDeadline'])
// (productId, fallbackRank) — optimises fallback chain lookups
@Index(['productId', 'fallbackRank'])
// Partial unique index: at most one bid per product can be the current payment-responsible bid
@Index(['productId'], {
  where: '"isCurrentlyPaymentResponsible" = true',
  unique: true,
})
export class Bid extends BaseEntity {
  // ─── Core ─────────────────────────────────────────────────────────────────

  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  // FK → products (ON DELETE RESTRICT). Declared here for JOIN support.
  @ManyToOne(() => Product, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Index()
  @Column({ type: 'uuid' })
  bidderId: string;

  // FK → users. Declared here for JOIN support when building bid-list responses.
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  placedAt: Date;

  // ─── Tracking ─────────────────────────────────────────────────────────────

  // Snapshot of product.currentHighestBid at the moment this bid was placed.
  // Null for the very first bid on a product.
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  previousHighestAmount: number | null;

  @Column({ type: 'boolean', default: false })
  wasFirstBid: boolean;

  // ─── Outcome (set by AuctionLifecycleService when auction closes) ─────────

  @Column({ type: 'boolean', default: false })
  isOriginalWinner: boolean;

  // 0 = original winner; 1, 2, … = fallback positions in the payment chain
  @Column({ type: 'int', default: 0 })
  fallbackRank: number;

  // Only ONE bid per product may have this true at any time (enforced by partial unique index above).
  @Column({ type: 'boolean', default: false })
  isCurrentlyPaymentResponsible: boolean;

  // ─── Payment ──────────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: BidPaymentStatus,
    default: BidPaymentStatus.NOT_RESPONSIBLE,
  })
  paymentStatus: BidPaymentStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paymentDeadline: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paymentConfirmedAt: Date | null;

  // UUID FK → users (the admin who confirmed payment). No explicit relation needed.
  @Column({ type: 'uuid', nullable: true })
  paymentConfirmedById: string | null;

  @Column({ type: 'enum', enum: PaymentConfirmationMethod, nullable: true })
  paymentConfirmationMethod: PaymentConfirmationMethod | null;

  // Used in Phase 2 to prevent duplicate "payment expiring soon" warning emails.
  @Column({ type: 'timestamptz', nullable: true })
  paymentWarningSentAt: Date | null;
}
