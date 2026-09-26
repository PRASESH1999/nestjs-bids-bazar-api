import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EncryptionService } from '@common/services/encryption.service';
import { StorageService } from '@common/services/storage.service';
import { DocumentType } from '@common/enums/document-type.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { KycRepository } from './kyc.repository';
import { BankDetailDto } from './dto/bank-detail.dto';
import { FindKycDto } from './dto/find-kyc.dto';
import { ReviewAction, ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { MailService } from '@modules/mail/mail.service';
import { UsersService } from '@modules/users/users.service';

/** The multipart field names a KYC submission can carry a document in. */
export type KycFileSlot =
  | 'citizenshipFront'
  | 'citizenshipBack'
  | 'passport'
  | 'nidFront';

/** The matching columns on KycVerification. */
export type KycPathKey =
  | 'citizenshipFrontPath'
  | 'citizenshipBackPath'
  | 'passportPath'
  | 'nidFrontPath';

export type KycFiles = Partial<Record<KycFileSlot, Express.Multer.File[]>>;

/** Filename prefix each slot is stored under. */
const SLOT_STORAGE_PREFIX: Record<KycFileSlot, string> = {
  citizenshipFront: 'citizenship-front',
  citizenshipBack: 'citizenship-back',
  passport: 'passport',
  nidFront: 'nid-front',
};

export interface SellEligibility {
  kycApproved: boolean;
  hasBankDetails: boolean;
  canSell: boolean;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly kycRepository: KycRepository,
    private readonly encryptionService: EncryptionService,
    private readonly storageService: StorageService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Document slots each type requires. Single source of truth for "is this
   * submission complete?", used both to validate and to decide which existing
   * file may be carried over on a resubmission.
   */
  private static readonly REQUIRED_SLOTS: Record<DocumentType, KycFileSlot[]> =
    {
      [DocumentType.CITIZENSHIP]: ['citizenshipFront', 'citizenshipBack'],
      [DocumentType.PASSPORT]: ['passport'],
      [DocumentType.NID_CARD]: ['nidFront'],
    };

  private static readonly SLOT_TO_PATH: Record<KycFileSlot, KycPathKey> = {
    citizenshipFront: 'citizenshipFrontPath',
    citizenshipBack: 'citizenshipBackPath',
    passport: 'passportPath',
    nidFront: 'nidFrontPath',
  };

  async submitKyc(userId: string, dto: SubmitKycDto, files: KycFiles) {
    const existing = await this.kycRepository.findKycByUserId(userId);

    if (existing?.status === KycStatus.PENDING) {
      throw new ConflictException('Your KYC is already under review');
    }
    if (existing?.status === KycStatus.APPROVED) {
      throw new ConflictException('Your KYC has already been approved');
    }

    /*
     * The phone gate. Verification now precedes KYC rather than hanging off it,
     * so a submission cannot be accepted from an account that has not proved a
     * number — there would be no reliable way to reach the applicant about it.
     */
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.phoneVerifiedAt) {
      throw new BadRequestException(
        'Verify your phone number before submitting KYC',
      );
    }

    /*
     * One document backs one account. Checked here so the applicant gets an
     * explanation; the partial unique index on (documentType, documentId) is
     * what actually guarantees it under a race.
     */
    const documentHolder = await this.kycRepository.findByDocumentIdentity(
      dto.documentType,
      dto.documentId,
    );
    if (documentHolder && documentHolder.userId !== userId) {
      throw new ConflictException(
        'That document is already registered to another account',
      );
    }

    /*
     * Which files this submission needs, and where each one comes from.
     *
     * On a **first** submission every required slot must be uploaded. On a
     * **resubmission** an omitted slot keeps the file already on file — a
     * rejection is usually about one thing, and forcing someone to
     * re-photograph a passport because their ward number was wrong is the kind
     * of friction that makes people give up. Changing document type is the
     * exception: nothing from the old type carries over.
     */
    const requiredSlots = KycService.REQUIRED_SLOTS[dto.documentType];
    const sameDocumentType = existing?.documentType === dto.documentType;

    const resolved: Record<KycPathKey, string | null> = {
      citizenshipFrontPath: null,
      citizenshipBackPath: null,
      passportPath: null,
      nidFrontPath: null,
    };
    const missing: string[] = [];
    const uploads: { slot: KycFileSlot; file: Express.Multer.File }[] = [];

    for (const slot of requiredSlots) {
      const pathKey = KycService.SLOT_TO_PATH[slot];
      const uploaded = files[slot]?.[0];
      const retained = sameDocumentType ? (existing?.[pathKey] ?? null) : null;

      if (uploaded) {
        uploads.push({ slot, file: uploaded });
      } else if (retained) {
        resolved[pathKey] = retained;
      } else {
        missing.push(slot);
      }
    }

    if (missing.length > 0) {
      throw new BadRequestException({
        message: `Missing required document file(s) for ${dto.documentType}: ${missing.join(', ')}`,
        fields: missing.map((slot) => ({
          field: slot,
          message: 'is required',
        })),
      });
    }

    /*
     * Write every new file BEFORE deleting anything it replaces.
     *
     * The previous order deleted the old files first, so a failure part-way
     * through the uploads left the applicant with a record pointing at files
     * that no longer existed — unreviewable, and unrecoverable without support.
     * If a save throws here, whatever was already written is cleaned up and the
     * record is left exactly as it was.
     */
    const written: string[] = [];
    try {
      for (const { slot, file } of uploads) {
        const savedPath = await this.storageService.saveFile(
          file,
          userId,
          SLOT_STORAGE_PREFIX[slot],
        );
        written.push(savedPath);
        resolved[KycService.SLOT_TO_PATH[slot]] = savedPath;
      }
    } catch (err: unknown) {
      await Promise.all(
        written.map((path) =>
          this.storageService.deleteFile(path).catch(() => undefined),
        ),
      );
      throw err;
    }

    // Files the record no longer points at: the slots just replaced, plus
    // everything belonging to a document type that was switched away from.
    const supersededPaths = existing
      ? (
          [
            'citizenshipFrontPath',
            'citizenshipBackPath',
            'passportPath',
            'nidFrontPath',
          ] as KycPathKey[]
        )
          .map((key) => existing[key])
          .filter((path): path is string => path !== null)
          .filter((path) => !Object.values(resolved).includes(path))
      : [];

    const kycPayload = {
      userId,
      fullName: dto.fullName,
      documentType: dto.documentType,
      documentId: dto.documentId,
      ...resolved,
      emergencyContactPhone: dto.emergencyContactPhone ?? null,
      permanentAddress: {
        street: dto.permanentAddressStreet,
        city: dto.permanentAddressCity ?? '',
        district: dto.permanentAddressDistrict ?? '',
        province: dto.permanentAddressProvince ?? '',
        country: dto.permanentAddressCountry ?? 'Nepal',
      },
      temporaryAddress: dto.temporaryAddressStreet
        ? {
            street: dto.temporaryAddressStreet,
            city: dto.temporaryAddressCity ?? '',
            district: dto.temporaryAddressDistrict ?? '',
            province: dto.temporaryAddressProvince ?? '',
            country: dto.temporaryAddressCountry ?? 'Nepal',
          }
        : null,
      remarks: dto.remarks ?? null,
      status: KycStatus.PENDING,
      // A resubmission is a fresh application: the previous verdict and the
      // fields it flagged must not follow it back into the queue.
      rejectionReason: null,
      rejectedFields: null,
      reviewedBy: null,
      reviewedAt: null,
    };

    let kyc;
    if (existing) {
      Object.assign(existing, kycPayload);
      kyc = await this.kycRepository.saveKyc(existing);
    } else {
      kyc = await this.kycRepository.saveKyc(
        this.kycRepository.createKyc(kycPayload),
      );
    }

    // Only now that the record points at the new files. Best-effort: an
    // orphaned file is a housekeeping problem, a failed submission is not.
    await Promise.all(
      supersededPaths.map((path) =>
        this.storageService.deleteFile(path).catch((err: unknown) => {
          this.logger.warn(
            `Failed to delete superseded KYC file ${path}: ` +
              `${err instanceof Error ? err.message : String(err)}`,
          );
        }),
      ),
    );

    await this.upsertBankDetails(userId, {
      bankName: dto.bankName,
      accountHolderName: dto.accountHolderName,
      accountNumber: dto.accountNumber,
      branch: dto.branch,
      swiftCode: dto.swiftCode,
    });

    await this.mailService.sendKycReceived(user.email, user.username);

    return {
      id: kyc.id,
      status: kyc.status,
      message: 'KYC submitted successfully. Your application is under review.',
    };
  }

  /**
   * Encrypts and upserts a user's bank_details row. Shared by `submitKyc`
   * (when bank fields are included in the submission) and
   * `addOrUpdateBankDetails` (adding/updating bank details independently,
   * any time after submission).
   */
  private async upsertBankDetails(
    userId: string,
    dto: BankDetailDto,
  ): Promise<void> {
    const bankPayload = {
      userId,
      bankName: dto.bankName,
      accountHolderName: dto.accountHolderName,
      accountNumber: this.encryptionService.encrypt(dto.accountNumber),
      branch: this.encryptionService.encrypt(dto.branch),
      swiftCode: dto.swiftCode
        ? this.encryptionService.encrypt(dto.swiftCode)
        : null,
    };

    const existingBank = await this.kycRepository.findBankByUserId(userId);
    if (existingBank) {
      Object.assign(existingBank, bankPayload);
      await this.kycRepository.saveBank(existingBank);
    } else {
      await this.kycRepository.saveBank(
        this.kycRepository.createBank(bankPayload),
      );
    }
  }

  /**
   * Add or update bank details independently of KYC (re)submission — the
   * only way to supply bank details once a KYC record has been APPROVED,
   * since submitKyc blocks resubmission at that point. Requires a KYC record
   * to already exist (any status).
   */
  async addOrUpdateBankDetails(
    userId: string,
    dto: BankDetailDto,
  ): Promise<{ message: string }> {
    const kyc = await this.kycRepository.findKycByUserId(userId);
    if (!kyc) {
      throw new NotFoundException('Submit your KYC before adding bank details');
    }

    await this.upsertBankDetails(userId, dto);
    return { message: 'Bank details saved successfully.' };
  }

  async hasBankDetails(userId: string): Promise<boolean> {
    const bank = await this.kycRepository.findBankByUserId(userId);
    return bank !== null;
  }

  /**
   * Combined status the frontend can poll to decide whether to show
   * "start selling" UI vs. a prompt to finish KYC/bank details.
   */
  async getSellEligibility(userId: string): Promise<SellEligibility> {
    const [kycApproved, hasBank] = await Promise.all([
      this.isVerified(userId),
      this.hasBankDetails(userId),
    ]);
    return {
      kycApproved,
      hasBankDetails: hasBank,
      canSell: kycApproved && hasBank,
    };
  }

  async getMyKyc(userId: string) {
    const kyc = await this.kycRepository.findKycByUserId(userId);
    if (!kyc) {
      return null;
    }

    const bank = await this.kycRepository.findBankByUserId(userId);

    return {
      id: kyc.id,
      status: kyc.status,
      fullName: kyc.fullName,
      documentType: kyc.documentType,
      documentId: kyc.documentId,
      citizenshipFrontUploaded: !!kyc.citizenshipFrontPath,
      citizenshipBackUploaded: !!kyc.citizenshipBackPath,
      passportUploaded: !!kyc.passportPath,
      nidFrontUploaded: !!kyc.nidFrontPath,
      /*
       * The applicant's own documents, viewable by them.
       *
       * Previously only the booleans above were returned, so someone correcting
       * a rejected submission could see *that* a passport was on file but not
       * which image it was — and since resubmission demanded every file again,
       * they had to re-photograph it blind. Now that omitted files are
       * retained, being able to look at what is already there is what makes
       * "replace only the flagged one" a decision rather than a guess.
       */
      citizenshipFrontUrl: kyc.citizenshipFrontPath
        ? this.getOwnDocumentUrl('citizenshipFront')
        : null,
      citizenshipBackUrl: kyc.citizenshipBackPath
        ? this.getOwnDocumentUrl('citizenshipBack')
        : null,
      passportUrl: kyc.passportPath ? this.getOwnDocumentUrl('passport') : null,
      nidFrontUrl: kyc.nidFrontPath ? this.getOwnDocumentUrl('nidFront') : null,
      emergencyContactPhone: kyc.emergencyContactPhone,
      permanentAddress: kyc.permanentAddress,
      temporaryAddress: kyc.temporaryAddress,
      remarks: kyc.remarks,
      rejectionReason: kyc.rejectionReason,
      // Empty array rather than null on a rejection with no flags, so the form
      // can tell "reviewer named nothing" from "not rejected".
      rejectedFields: kyc.rejectedFields ?? [],
      reviewedAt: kyc.reviewedAt,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      bank: bank
        ? {
            bankName: bank.bankName,
            accountHolderName: bank.accountHolderName,
            accountNumber: this.maskAccountNumber(
              this.encryptionService.decrypt(bank.accountNumber),
            ),
          }
        : null,
      // NOTE: the document URLs above are the self-service ones. This response
      // used to carry `getVirtualDocumentUrl(kyc.id, …)` here instead, which
      // points at the ADMIN-only `/kyc/:id/documents/:fileKey` — so the
      // applicant was handed four links that answered 403 for them. That is
      // why the correction form never showed what was already on file.
    };
  }

  /** Self-service document URL — no KYC id in it, the JWT decides the record. */
  private getOwnDocumentUrl(fileKey: string): string {
    return `/api/v1/kyc/me/documents/${fileKey}`;
  }

  async getAllKyc(query: FindKycDto) {
    const { page = 1, limit = 20, status, userId } = query;
    const [records, total] = await this.kycRepository.findAllKycPaginated(
      page,
      limit,
      status,
      userId,
    );

    // One lookup for the page, never one per row.
    const applicants = await this.usersService.findByIds(
      records.map((kyc) => kyc.userId),
    );
    const applicantById = new Map(applicants.map((u) => [u.id, u]));

    const data = records.map((kyc) => ({
      id: kyc.id,
      userId: kyc.userId,
      status: kyc.status,
      fullName: kyc.fullName,
      documentType: kyc.documentType,
      documentId: kyc.documentId,
      applicantUsername: applicantById.get(kyc.userId)?.username ?? null,
      applicantPhone: applicantById.get(kyc.userId)?.phone ?? null,
      applicantPhoneVerified:
        applicantById.get(kyc.userId)?.phoneVerifiedAt != null,
      rejectionReason: kyc.rejectionReason,
      rejectedFields: kyc.rejectedFields ?? [],
      reviewedAt: kyc.reviewedAt,
      createdAt: kyc.createdAt,
      citizenshipFrontUrl: kyc.citizenshipFrontPath
        ? this.getVirtualDocumentUrl(kyc.id, 'citizenshipFront')
        : null,
      citizenshipBackUrl: kyc.citizenshipBackPath
        ? this.getVirtualDocumentUrl(kyc.id, 'citizenshipBack')
        : null,
      passportUrl: kyc.passportPath
        ? this.getVirtualDocumentUrl(kyc.id, 'passport')
        : null,
      nidFrontUrl: kyc.nidFrontPath
        ? this.getVirtualDocumentUrl(kyc.id, 'nidFront')
        : null,
    }));

    return { data, meta: { page, limit, total } };
  }

  async getKycById(id: string) {
    const kyc = await this.kycRepository.findKycById(id);
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }

    const [bank, applicant] = await Promise.all([
      this.kycRepository.findBankByUserId(kyc.userId),
      this.usersService.findById(kyc.userId),
    ]);

    return {
      id: kyc.id,
      userId: kyc.userId,
      fullName: kyc.fullName,
      documentType: kyc.documentType,
      documentId: kyc.documentId,
      /*
       * The applicant's account phone, read off the user rather than the
       * submission — that is where it lives now. The reviewer needs it because
       * approval is refused while it is unverified, so without it the Approve
       * button fails for a reason nothing on the page explains.
       */
      applicantUsername: applicant?.username ?? null,
      applicantPhone: applicant?.phone ?? null,
      applicantPhoneVerified: applicant?.phoneVerifiedAt != null,
      emergencyContactPhone: kyc.emergencyContactPhone,
      permanentAddress: kyc.permanentAddress,
      temporaryAddress: kyc.temporaryAddress,
      remarks: kyc.remarks,
      status: kyc.status,
      rejectionReason: kyc.rejectionReason,
      rejectedFields: kyc.rejectedFields ?? [],
      reviewedBy: kyc.reviewedBy,
      reviewedAt: kyc.reviewedAt,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
      bank: bank
        ? {
            bankName: bank.bankName,
            accountHolderName: bank.accountHolderName,
            accountNumber: this.maskAccountNumber(
              this.encryptionService.decrypt(bank.accountNumber),
            ),
            // Not secrets — they identify the branch, not the account — and a
            // reviewer checks them against the bank. Only the account number
            // stays masked here; GET /kyc/:id/bank is the decrypted view.
            branch: this.encryptionService.decrypt(bank.branch),
            swiftCode: bank.swiftCode
              ? this.encryptionService.decrypt(bank.swiftCode)
              : null,
          }
        : null,
      citizenshipFrontUrl: kyc.citizenshipFrontPath
        ? this.getVirtualDocumentUrl(kyc.id, 'citizenshipFront')
        : null,
      citizenshipBackUrl: kyc.citizenshipBackPath
        ? this.getVirtualDocumentUrl(kyc.id, 'citizenshipBack')
        : null,
      passportUrl: kyc.passportPath
        ? this.getVirtualDocumentUrl(kyc.id, 'passport')
        : null,
      nidFrontUrl: kyc.nidFrontPath
        ? this.getVirtualDocumentUrl(kyc.id, 'nidFront')
        : null,
    };
  }

  async reviewKyc(id: string, dto: ReviewKycDto, reviewerUserId: string) {
    const kyc = await this.kycRepository.findKycById(id);
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }

    if (dto.action === ReviewAction.REJECT && !dto.rejectionReason) {
      throw new BadRequestException(
        'rejectionReason is required when rejecting a KYC submission',
      );
    }

    const user = await this.usersService.findById(kyc.userId);
    if (!user) throw new NotFoundException('Applicant not found');

    // The gate moved to User along with the number itself. Kept on approval as
    // well as on submission: a submission predating the move may never have
    // been verified, and approving it would hand out seller rights to an
    // account nobody can reach.
    if (dto.action === ReviewAction.APPROVE && !user.phoneVerifiedAt) {
      throw new BadRequestException(
        'Cannot approve: the applicant’s phone number is not verified',
      );
    }

    kyc.status =
      dto.action === ReviewAction.APPROVE
        ? KycStatus.APPROVED
        : KycStatus.REJECTED;
    kyc.reviewedBy = reviewerUserId;
    kyc.reviewedAt = new Date();
    kyc.rejectionReason =
      dto.action === ReviewAction.REJECT ? (dto.rejectionReason ?? null) : null;
    // Cleared on approval so a later rejection cannot inherit stale flags.
    kyc.rejectedFields =
      dto.action === ReviewAction.REJECT ? (dto.rejectedFields ?? null) : null;

    const updatedKyc = await this.kycRepository.saveKyc(kyc);

    // Addressed by handle: User carries no name, and the KYC full name is only
    // authoritative once approved — using it on a rejection would address
    // someone by a name the platform has just declined to accept.
    if (dto.action === ReviewAction.APPROVE) {
      await this.mailService.sendKycApproved(user.email, user.username);
    } else {
      await this.mailService.sendKycRejected(
        user.email,
        user.username,
        dto.rejectionReason!,
      );
    }

    return updatedKyc;
  }

  /*
   * Phone verification used to live here, keyed off the KYC row. It now lives
   * on the account (UsersModule → PhoneVerificationService), because it has to
   * happen *before* a submission rather than alongside one: submitKyc refuses
   * an account whose number is unverified. Nothing about a person's phone is
   * specific to one KYC application.
   */

  async getDecryptedBankDetails(kycId: string) {
    const kyc = await this.kycRepository.findKycById(kycId);
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }

    const bank = await this.kycRepository.findBankByUserId(kyc.userId);
    if (!bank) {
      throw new NotFoundException('Bank details not found for this KYC record');
    }

    return {
      id: bank.id,
      userId: bank.userId,
      bankName: bank.bankName,
      accountHolderName: bank.accountHolderName,
      accountNumber: this.encryptionService.decrypt(bank.accountNumber),
      branch: this.encryptionService.decrypt(bank.branch),
      swiftCode: bank.swiftCode
        ? this.encryptionService.decrypt(bank.swiftCode)
        : null,
    };
  }

  /**
   * Streams one document off a submission.
   *
   * `ownerUserId`, when given, scopes the lookup to that applicant — the
   * self-service route passes it so a caller can only ever reach their own
   * files. Admin callers omit it. A mismatch is a 404 rather than a 403: it
   * does not confirm whose record the id belongs to.
   */
  async getDocumentFile(
    id: string,
    fileKey: string,
    ownerUserId?: string,
  ): Promise<{ absolutePath: string; mimetype: string }> {
    const kyc = await this.kycRepository.findKycById(id);
    if (!kyc || (ownerUserId !== undefined && kyc.userId !== ownerUserId)) {
      throw new NotFoundException('KYC record not found');
    }

    const pathMap: Record<string, string | null> = {
      citizenshipFront: kyc.citizenshipFrontPath,
      citizenshipBack: kyc.citizenshipBackPath,
      passport: kyc.passportPath,
      nidFront: kyc.nidFrontPath,
    };

    if (!(fileKey in pathMap)) {
      throw new NotFoundException(
        `Invalid document key '${fileKey}'. Valid keys: citizenshipFront, citizenshipBack, passport, nidFront`,
      );
    }

    const relativePath = pathMap[fileKey];
    if (!relativePath) {
      throw new NotFoundException(
        `Document '${fileKey}' was not uploaded for this KYC record`,
      );
    }

    const ext = relativePath.split('.').pop()?.toLowerCase() ?? '';
    const MIME_MAP: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      pdf: 'application/pdf',
    };

    return {
      absolutePath: this.storageService.getFilePath(relativePath),
      mimetype: MIME_MAP[ext] ?? 'application/octet-stream',
    };
  }

  async isVerified(userId: string): Promise<boolean> {
    const kyc = await this.kycRepository.findKycByUserId(userId);
    return kyc?.status === KycStatus.APPROVED;
  }

  private maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  }

  private getVirtualDocumentUrl(kycId: string, fileKey: string): string {
    return `/api/v1/kyc/${kycId}/documents/${fileKey}`;
  }
}
