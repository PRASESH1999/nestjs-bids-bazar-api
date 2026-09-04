import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Payment } from '@modules/payments/entities/payment.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('seller_ratings')
// One rating per completed transaction — never per buyer/seller pair, so the
// same buyer can rate the same seller again via a separate later purchase.
@Index(['paymentId'], { unique: true })
// Backs "this seller's ratings, most recent first" and the aggregate recompute.
@Index(['sellerId', 'createdAt'])
export class SellerRating extends BaseEntity {
  @Column({ type: 'uuid' })
  buyerId: string;

  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'buyerId' })
  buyer: User;

  @Column({ type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  // The completed transaction being rated. This codebase has no separate
  // Order entity — a SUCCESS Payment row is created 1:1 with a product
  // reaching ProductStatus.SETTLED (see AuctionLifecycleService.
  // confirmPaymentManual/confirmPaymentGateway + PaymentsService.confirmSuccess),
  // so Payment is the closest thing to "the order" and is unique per sale.
  @Column({ type: 'uuid' })
  paymentId: string;

  // FK → payments (ON DELETE RESTRICT) — a rating must never outlive the
  // transaction it's about.
  @ManyToOne(() => Payment, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}
