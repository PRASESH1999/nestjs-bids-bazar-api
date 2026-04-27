import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('bank_details')
export class BankDetail extends BaseEntity {
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  bankName: string;

  @Column({ type: 'varchar', length: 255 })
  accountHolderName: string;

  @Column({ type: 'text' })
  accountNumber: string; // AES-256-GCM encrypted

  @Column({ type: 'text' })
  branch: string; // AES-256-GCM encrypted

  @Column({ type: 'text', nullable: true })
  swiftCode: string | null; // AES-256-GCM encrypted
}
