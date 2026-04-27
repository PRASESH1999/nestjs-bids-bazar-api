import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@common/entities/base.entity';
import { DocumentType } from '@common/enums/document-type.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';

export interface AddressData {
  street: string;
  city: string;
  district: string;
  province: string;
  country: string;
}

@Entity('kyc_verifications')
export class KycVerification extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  @Column({ type: 'varchar', nullable: true })
  citizenshipFrontPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  citizenshipBackPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  passportPath: string | null;

  @Column({ type: 'jsonb' })
  permanentAddress: AddressData;

  @Column({ type: 'jsonb', nullable: true })
  temporaryAddress: AddressData | null;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  status: KycStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
