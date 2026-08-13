import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { PointsTransactionType } from '@common/enums/points-transaction-type.enum';

// Audit ledger — every point movement, automatic or admin-manual, is logged
// here. referenceId is the triggering Payment.id for automatic awards, null
// for manual admin adjustments (see RewardsService.adjustPoints).
@Entity('points_transactions')
@Index(['userId', 'createdAt'])
export class PointsTransaction extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: PointsTransactionType })
  type: PointsTransactionType;

  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;
}
