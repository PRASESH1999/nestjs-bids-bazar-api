import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { ReportStatus } from '@common/enums/report-status.enum';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('product_reports')
// A user can report a given product only once — enforced at the DB level.
@Index(['reporterId', 'productId'], { unique: true })
// Backs the admin queue filtered by status, and by the reported seller.
@Index(['status', 'createdAt'])
@Index(['reportedUserId'])
export class ProductReport extends BaseEntity {
  @Column({ type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column({ type: 'uuid' })
  productId: string;

  // FK → products (ON DELETE RESTRICT) — mirrors Favorite's relation to Product.
  @ManyToOne(() => Product, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // The product's seller, copied at report time. A report is effectively
  // against the seller, not the listing — this keeps that link intact even
  // if the product is later withdrawn or otherwise leaves circulation.
  @Column({ type: 'uuid' })
  reportedUserId: string;

  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'reportedUserId' })
  reportedUser: User;

  @Column({ type: 'text' })
  remarks: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  // Internal admin-only note. Never exposed to non-admins — only the admin
  // endpoints in this module read ProductReport at all.
  @Column({ type: 'text', nullable: true })
  adminNote: string | null;
}
