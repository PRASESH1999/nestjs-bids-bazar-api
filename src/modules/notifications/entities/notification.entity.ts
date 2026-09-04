import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { NotificationType } from '@common/enums/notification-type.enum';

@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
@Index(['userId', 'type', 'relatedId'], { unique: true })
export class Notification extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  // Id of the row that triggered this notification (bid or product id,
  // depending on `type`). Used only for the idempotency index above and as
  // a deep-link aid for the frontend — never joined against.
  @Column({ type: 'uuid' })
  relatedId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
