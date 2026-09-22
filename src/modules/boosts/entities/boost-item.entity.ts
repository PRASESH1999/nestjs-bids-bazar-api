import { BaseEntity } from '@common/entities/base.entity';
import { BoostItemStatus } from '@common/enums/boost-item-status.enum';
import { BoostScheme } from '@common/enums/boost-scheme.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

// One row per boost purchase. Starts PENDING_PAYMENT; flips to ACTIVE (with
// start/end stamped) once its BoostPayment succeeds, or to CANCELLED if that
// payment fails/expires first. An ACTIVE row flips to EXPIRED once
// endDateTime passes (see BoostsCron.expireEndedBoosts) — that's what frees
// the product up for a new purchase, per the partial unique index below.
@Entity('boost_items')
@Index(['status', 'startDateTime'])
@Index(['productId', 'status'])
// At most one in-flight or currently-running boost per product at a time.
@Index(['productId'], {
  where: `"status" IN ('PENDING_PAYMENT', 'ACTIVE')`,
  unique: true,
})
export class BoostItem extends BaseEntity {
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

  // Denormalized from product.ownerId at purchase time — avoids a join for
  // admin/seller listing views.
  @Column({ type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'enum', enum: BoostScheme })
  scheme: BoostScheme;

  // Snapshotted from BOOST_PLANS at purchase time — immune to later price changes.
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: BoostItemStatus,
    default: BoostItemStatus.PENDING_PAYMENT,
  })
  status: BoostItemStatus;

  // Stamped when the BoostPayment succeeds — null until then.
  @Column({ type: 'timestamptz', nullable: true })
  startDateTime: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endDateTime: Date | null;
}
