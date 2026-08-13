import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { SellerTier } from '@common/enums/seller-tier.enum';

// 1:1 with User, modeled the same way as KycVerification — a plain unique
// userId column, looked up manually in the service layer. No ORM relation.
@Entity('user_rewards')
export class UserRewards extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'int', default: 0 })
  buyerPoints: number;

  @Column({ type: 'int', default: 0 })
  sellerPoints: number;

  @Column({
    type: 'enum',
    enum: SellerTier,
    default: SellerTier.BRONZE,
  })
  sellerTier: SellerTier;
}
