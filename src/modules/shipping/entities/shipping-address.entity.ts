import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { User } from '@modules/users/entities/user.entity';

/**
 * A delivery address a buyer has saved for reuse at checkout.
 *
 * Capped at {@link MAX_SHIPPING_ADDRESSES} per user — enforced in the service,
 * not by a constraint, because the limit is a product rule with a message
 * attached rather than a data invariant.
 *
 * Deliberately **not** linked to the KYC addresses. Those are a seller's
 * permanent and temporary residence as printed on an identity document; these
 * are wherever a buyer wants a parcel delivered, which may be an office, a
 * relative's house, or a city they do not live in. Conflating the two would
 * mean editing a delivery address mutated a verified identity record.
 */
@Entity('shipping_addresses')
@Index(['userId', 'isDefault'])
export class ShippingAddress extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false, eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** What the buyer calls it — "Home", "Office". Their own words. */
  @Column({ type: 'varchar', length: 50 })
  label: string;

  /*
   * Who receives the parcel, and on what number. Kept per-address rather than
   * read off the account: people ship to other people, and the courier needs
   * to reach whoever is actually at that door.
   */
  @Column({ type: 'varchar', length: 150 })
  recipientName: string;

  @Column({ type: 'varchar', length: 20 })
  recipientPhone: string;

  @Column({ type: 'varchar', length: 100 })
  province: string;

  @Column({ type: 'varchar', length: 100 })
  district: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 255 })
  street: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  wardNumber: string | null;

  /** Free-text directions for the courier ("blue gate opposite the school"). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  landmark: string | null;

  /*
   * Which address the checkout form preselects. At most one per user, kept true
   * by the service clearing the others inside the same transaction — a partial
   * unique index was rejected because "no default at all" is a legitimate state
   * (every address deleted) and the service already has to reassign on delete.
   */
  @Column({ type: 'boolean', default: false })
  isDefault: boolean;
}

/**
 * The per-user cap. Five is enough for home, work and a few relatives, and
 * keeps the checkout picker a list rather than a search problem.
 */
export const MAX_SHIPPING_ADDRESSES = 5;
