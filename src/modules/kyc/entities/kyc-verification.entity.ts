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
// One identity document may back exactly one account. Scoped to the type
// because the numbers live in different namespaces — a citizenship number and
// a passport number are unrelated sequences and could coincide.
@Index(['documentType', 'documentId'], { unique: true })
export class KycVerification extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', unique: true })
  userId: string;

  /*
   * The name under review: a snapshot of User.fullName taken at submission.
   *
   * The applicant no longer types it into the KYC form — it was collected at
   * registration. It is copied here so the record keeps exactly what the
   * reviewer compared against the document, even if a later rejection leads
   * the user to correct the name on their account and resubmit.
   */
  @Column({ type: 'varchar', length: 150 })
  fullName: string;

  @Column({ type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  /*
   * The identifying number printed on the chosen document — citizenship
   * number, passport number or NID number.
   *
   * Unique per document type (see the index above), which is what stops one
   * physical document backing two accounts. Without it the only thing tying a
   * submission to a real document was the photograph, and nothing prevented
   * the same citizenship certificate being submitted twice.
   */
  @Column({ type: 'varchar', length: 50 })
  documentId: string;

  @Column({ type: 'varchar', nullable: true })
  citizenshipFrontPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  citizenshipBackPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  passportPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  nidFrontPath: string | null;

  /*
   * An alternative number for reaching the applicant — next of kin, a landline,
   * a colleague. Not verified and not used to sign in.
   *
   * The account's own phone moved to User.phone, where it is verified before
   * KYC can be submitted at all. This field was called `secondaryPhone`, which
   * stopped meaning anything once there was no primary beside it.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  emergencyContactPhone: string | null;

  @Column({ type: 'jsonb' })
  permanentAddress: AddressData;

  @Column({ type: 'jsonb', nullable: true })
  temporaryAddress: AddressData | null;

  // Free-text note from the applicant, entered at submission time (e.g. to
  // explain a name mismatch between documents). Optional, reviewer-facing.
  @Column({ type: 'varchar', length: 1000, nullable: true })
  remarks: string | null;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  status: KycStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  /*
   * Which parts of the submission the reviewer flagged, as field keys
   * (`fullName`, `documentId`, `citizenshipFront`, `permanentAddress`, …).
   *
   * `rejectionReason` is prose and cannot be acted on programmatically, so the
   * applicant was left re-reading a sentence and guessing which upload to
   * redo. This lets the form point at the specific items. Null on an approval,
   * and empty on a rejection where the reviewer named no specific field.
   */
  @Column({ type: 'jsonb', nullable: true })
  rejectedFields: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
