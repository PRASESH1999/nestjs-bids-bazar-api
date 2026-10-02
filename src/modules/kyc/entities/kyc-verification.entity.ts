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
// a passport number are unrelated sequences and could coincide. Partial, so
// the rows that predate `documentId` (which have none) don't collide on null.
@Index(['documentType', 'documentId'], {
  unique: true,
  where: '"documentId" IS NOT NULL',
})
export class KycVerification extends BaseEntity {
  @Index()
  @Column({ type: 'uuid', unique: true })
  userId: string;

  /*
   * The applicant's legal full name, as printed on the document.
   *
   * This is the authoritative name for the account — User carries none (see
   * that entity's note). It is only trustworthy once `status` is APPROVED,
   * which is precisely why it sits behind review rather than on the profile.
   *
   * Nullable at the DB level because rows predating this field have no value;
   * required by SubmitKycDto for every submission going forward.
   */
  @Column({ type: 'varchar', length: 150, nullable: true })
  fullName: string | null;

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
   *
   * Nullable for the same reason as `fullName`: existing rows have none.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  documentId: string | null;

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
