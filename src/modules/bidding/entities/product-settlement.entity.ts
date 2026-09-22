import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { SettlementStatus } from '@common/enums/settlement-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { Bid } from './bid.entity';

// One row per fallback round on a product: who was responsible, at what rank,
// and how that round resolved. Insert-only per round — a round's own row is
// only ever updated to flip its status (PENDING_PAYMENT -> SETTLED/EXPIRED),
// never overwritten to represent a different round. This is what lets the
// full winner history for a product be reconstructed, unlike the live `Bid`
// columns which only expose current state.
@Entity('product_settlements')
@Index(['productId', 'fallbackRank'])
// Partial unique index: at most one PENDING_PAYMENT round per product at a time.
@Index(['productId'], {
  where: `"status" = 'PENDING_PAYMENT'`,
  unique: true,
})
export class ProductSettlement extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'uuid' })
  sellerId: string;

  // Denormalized from product.ownerId at round-creation time — avoids a join
  // for admin history/reporting views.
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  // The exact bid this round covers — lets this row link back to
  // fallbackRank/paymentDeadline on Bid without duplicating them here.
  @Index()
  @Column({ type: 'uuid' })
  bidId: string;

  @ManyToOne(() => Bid, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'bidId' })
  bid: Bid;

  @Column({ type: 'uuid' })
  bidWinnerId: string;

  // Denormalized from bid.bidderId — avoids a join for admin history views.
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'bidWinnerId' })
  bidWinner: User;

  // 0 = original winner, 1 = 2nd bidder, 2 = 3rd bidder. Capped at 2 — a
  // round past rank 2 is never created; the product is marked ABANDONED
  // instead (see AuctionLifecycleService.handlePaymentExpiry).
  @Column({ type: 'int' })
  fallbackRank: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.PENDING_PAYMENT,
  })
  status: SettlementStatus;

  @Column({ type: 'timestamptz' })
  paymentDeadline: Date;

  // When this round's status left PENDING_PAYMENT (settled or expired).
  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
