import { BaseEntity } from '@common/entities/base.entity';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BoostItem } from './boost-item.entity';

@Entity('boost_payments')
@Index(['productId', 'status'])
@Index(['sellerId', 'status'])
// At most one in-flight (PENDING) QR attempt per boost item at a time.
@Index(['boostItemId'], { where: `"status" = 'PENDING'`, unique: true })
export class BoostPayment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  boostItemId: string;

  @ManyToOne(() => BoostItem, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'boostItemId' })
  boostItem: BoostItem;

  // Denormalized from BoostItem.productId — avoids a join for admin
  // listing/filtering views.
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

  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // Correlation key across the Fonepay flow; also used as Fonepay's `prn`.
  // Alphanumeric only, ≤30 chars. Globally unique — enforced by DB constraint.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  referenceLabel: string;

  @Column({ type: 'varchar', length: 16 })
  terminalId: string;

  // Full QR payload — used to render the scannable image on desktop.
  @Column({ type: 'text', nullable: true })
  qrString: string | null;

  // Short payload — combined with the bank's intentScheme on the frontend for
  // the mobile deep link.
  @Column({ type: 'text', nullable: true })
  qrMessage: string | null;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  // ─── Fonepay outcome (populated after status verification) ────────────────

  @Column({ type: 'varchar', nullable: true })
  fonepayTraceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentMessage: string | null;

  @Column({ type: 'timestamptz' })
  paymentDeadline: Date;
}
