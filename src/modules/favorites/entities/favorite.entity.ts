import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { Product } from '@modules/products/entities/product.entity';
import { User } from '@modules/users/entities/user.entity';

@Entity('favorites')
// Enforces "a user can't favorite the same product twice" at the DB level.
@Index(['userId', 'productId'], { unique: true })
// Backs the paginated "my favorites, most recent first" list query.
@Index(['userId', 'createdAt'])
export class Favorite extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  // FK → users. Declared for JOIN support and referential integrity.
  @ManyToOne(() => User, { nullable: false, eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  productId: string;

  // FK → products (ON DELETE RESTRICT) — mirrors Bid's relation to Product.
  // Favorites are never cascade-deleted when a product changes state; only an
  // explicit unfavorite action removes the row.
  @ManyToOne(() => Product, {
    onDelete: 'RESTRICT',
    nullable: false,
    eager: false,
  })
  @JoinColumn({ name: 'productId' })
  product: Product;
}
