import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { EncryptionService } from '@common/services/encryption.service';
import { StorageService } from '@common/services/storage.service';
import { DocumentType } from '@common/enums/document-type.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { KycRepository } from './kyc.repository';
import { BankDetailDto } from './dto/bank-detail.dto';
import { FindKycDto } from './dto/find-kyc.dto';
import { ReviewAction, ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { KycVerification } from './entities/kyc-verification.entity';
import { MailService } from '@modules/mail/mail.service';
import { UsersService } from '@modules/users/users.service';
import { SparrowSmsService } from '@modules/sms/sparrow-sms.service';

const PHONE_OTP_TTL_MS = 5 * 60 * 1000;
const PHONE_OTP_MAX_ATTEMPTS = 5;

export interface KycFiles {
  citizenshipFront?: Express.Multer.File[];
  citizenshipBack?: Express.Multer.File[];
  passport?: Express.Multer.File[];
  nidFront?: Express.Multer.File[];
}

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
    private readonly smsService: SparrowSmsService,
  ) {}

  async submitKyc(userId: string, dto: SubmitKycDto, files: KycFiles) {
    const existing = await this.kycRepository.findKycByUserId(userId);

    if (existing?.status === KycStatus.PENDING) {
      throw new ConflictException('Your KYC is already under review');
    }
    if (existing?.status === KycStatus.APPROVED) {
      throw new ConflictException('Your KYC has already been approved');
    }

    // Validate document + file combination
    const front = files.citizenshipFront?.[0];
    const back = files.citizenshipBack?.[0];
    const passport = files.passport?.[0];
    const nidFront = files.nidFront?.[0];

    if (dto.documentType === DocumentType.CITIZENSHIP) {
      if (!front || !back) {
        throw new BadRequestException(
          'Both citizenshipFront and citizenshipBack files are required for CITIZENSHIP',
        );
      }
    } else if (dto.documentType === DocumentType.PASSPORT) {
      if (!passport) {
        throw new BadRequestException(
          'A passport file is required for PASSPORT',
        );
      }
    } else {
      if (!nidFront) {
        throw new BadRequestException(
          'A nidFront file is required for NID_CARD',
        );
      }
    }

    // Delete old files when resubmitting after REJECTED
    if (existing) {
      const oldPaths = [
        existing.citizenshipFrontPath,
        existing.citizenshipBackPath,
        existing.passportPath,
        existing.nidFrontPath,
      ].filter((p): p is string => p !== null);
      await Promise.all(oldPaths.map((p) => this.storageService.deleteFile(p)));
    }

    // Persist new files
    let citizenshipFrontPath: string | null = null;
    let citizenshipBackPath: string | null = null;
    let passportPath: string | null = null;
    let nidFrontPath: string | null = null;

    if (dto.documentType === DocumentType.CITIZENSHIP) {
      citizenshipFrontPath = await this.storageService.saveFile(
        front!,
        userId,
        'citizenship-front',
      );
      citizenshipBackPath = await this.storageService.saveFile(
        back!,
        userId,
        'citizenship-back',
      );
    } else if (dto.documentType === DocumentType.PASSPORT) {
      passportPath = await this.storageService.saveFile(
        passport!,
        userId,
        'passport',
      );
    } else {
      nidFrontPath = await this.storageService.saveFile(
        nidFront!,
        userId,
        'nid-front',
      );
    }

    // A previously-verified phone survives resubmission only if the number
    // didn't change — otherwise it must be re-verified from scratch.
    const keepPhoneVerification =
      existing?.phoneVerifiedAt != null &&
      existing.primaryPhone === dto.primaryPhone;

    // Save KYC record (update on resubmission, create otherwise)
    const kycPayload = {
      userId,
      documentType: dto.documentType,
      citizenshipFrontPath,
      citizenshipBackPath,
      passportPath,
      nidFrontPath,
      primaryPhone: dto.primaryPhone,
      secondaryPhone: dto.secondaryPhone ?? null,
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
      status: KycStatus.PENDING,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
      phoneVerifiedAt: keepPhoneVerification ? existing.phoneVerifiedAt : null,
      phoneOtpHash: null,
      phoneOtpExpiresAt: null,
      phoneOtpAttempts: 0,
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

    if (!keepPhoneVerification) {
      // Non-fatal: a Sparrow outage must not fail the whole submission —
      // the seller can always request a fresh code later via send-otp.
      try {
        await this.issueAndSendOtp(kyc);
      } catch (err: unknown) {
        this.logger.error(
          `Failed to auto-send phone OTP on submit for KYC ${kyc.id}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await this.upsertBankDetails(userId, {
      bankName: dto.bankName,
      accountHolderName: dto.accountHolderName,
      accountNumber: dto.accountNumber,
      branch: dto.branch,
      swiftCode: dto.swiftCode,
    });

    // Send notification email
    const user = await this.usersService.findById(userId);
    if (user) {
      await this.mailService.sendKycReceived(user.email, user.name);
    }

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
      documentType: kyc.documentType,
      citizenshipFrontUploaded: !!kyc.citizenshipFrontPath,
      citizenshipBackUploaded: !!kyc.citizenshipBackPath,
      passportUploaded: !!kyc.passportPath,
      nidFrontUploaded: !!kyc.nidFrontPath,
      primaryPhone: kyc.primaryPhone,
      secondaryPhone: kyc.secondaryPhone,
      permanentAddress: kyc.permanentAddress,
      temporaryAddress: kyc.temporaryAddress,
      rejectionReason: kyc.rejectionReason,
      phoneVerifiedAt: kyc.phoneVerifiedAt,
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

  async getAllKyc(query: FindKycDto) {
    const { page = 1, limit = 20, status } = query;
    const [records, total] = await this.kycRepository.findAllKycPaginated(
      page,
      limit,
      status,
    );

    const data = records.map((kyc) => ({
      id: kyc.id,
      userId: kyc.userId,
      status: kyc.status,
      documentType: kyc.documentType,
      rejectionReason: kyc.rejectionReason,
      phoneVerifiedAt: kyc.phoneVerifiedAt,
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

    const bank = await this.kycRepository.findBankByUserId(kyc.userId);

    return {
      id: kyc.id,
      userId: kyc.userId,
      documentType: kyc.documentType,
      primaryPhone: kyc.primaryPhone,
      secondaryPhone: kyc.secondaryPhone,
      permanentAddress: kyc.permanentAddress,
      temporaryAddress: kyc.temporaryAddress,
      status: kyc.status,
      rejectionReason: kyc.rejectionReason,
      phoneVerifiedAt: kyc.phoneVerifiedAt,
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

    if (dto.action === ReviewAction.APPROVE && !kyc.phoneVerifiedAt) {
      throw new BadRequestException(
        'Cannot approve: phone number is not verified yet',
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

    const updatedKyc = await this.kycRepository.saveKyc(kyc);

    // Send notification email
    const user = await this.usersService.findById(kyc.userId);
    if (user) {
      if (dto.action === ReviewAction.APPROVE) {
        await this.mailService.sendKycApproved(user.email, user.name);
      } else {
        await this.mailService.sendKycRejected(
          user.email,
          user.name,
          dto.rejectionReason!,
        );
      }
    }

    return updatedKyc;
  }

  // ─── Phone verification ───────────────────────────────────────────────────

  /**
   * Generates a fresh OTP, sends it via Sparrow, and persists its hash.
   * Throws (propagates the SMS failure) if the send itself fails — callers
   * that want a non-fatal auto-send (e.g. on submit) must catch it themselves.
   */
  private async issueAndSendOtp(kyc: KycVerification): Promise<void> {
    if (!kyc.primaryPhone) {
      throw new BadRequestException(
        'No phone number on file for this KYC submission',
      );
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    await this.smsService.sendSms(
      kyc.primaryPhone,
      `Your BidsBazar phone verification code is ${code}. It expires in 5 minutes.`,
    );

    kyc.phoneOtpHash = codeHash;
    kyc.phoneOtpExpiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS);
    kyc.phoneOtpAttempts = 0;
    await this.kycRepository.saveKyc(kyc);
  }

  /**
   * Requests a fresh OTP for the caller's own KYC submission. Callable at any
   * time before verification — there is no deadline tied to submission.
   */
  async sendPhoneOtp(userId: string): Promise<{ message: string }> {
    const kyc = await this.kycRepository.findKycByUserId(userId);
    if (!kyc) {
      throw new NotFoundException('Submit KYC before verifying your phone');
    }
    if (kyc.phoneVerifiedAt) {
      throw new BadRequestException('Phone number is already verified');
    }

    await this.issueAndSendOtp(kyc);
    return { message: 'Verification code sent' };
  }

  /**
   * Verifies the caller's own KYC phone OTP. Admin approval is blocked on
   * `phoneVerifiedAt` (see reviewKyc) but this endpoint itself is independent
   * of KYC status — a rejected submission can still get its phone verified
   * ahead of a resubmission with the same number.
   */
  async verifyPhoneOtp(
    userId: string,
    dto: VerifyPhoneOtpDto,
  ): Promise<{ message: string }> {
    const kyc = await this.kycRepository.findKycByUserId(userId);
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }
    if (kyc.phoneVerifiedAt) {
      return { message: 'Phone number already verified' };
    }

    if (!kyc.phoneOtpHash || !kyc.phoneOtpExpiresAt) {
      throw new BadRequestException(
        'No verification code requested. Please request one first.',
      );
    }
    if (kyc.phoneOtpExpiresAt < new Date()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }
    if (kyc.phoneOtpAttempts >= PHONE_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    const codeHash = crypto.createHash('sha256').update(dto.code).digest('hex');

    if (codeHash !== kyc.phoneOtpHash) {
      kyc.phoneOtpAttempts += 1;
      await this.kycRepository.saveKyc(kyc);
      throw new BadRequestException('Incorrect verification code');
    }

    kyc.phoneVerifiedAt = new Date();
    kyc.phoneOtpHash = null;
    kyc.phoneOtpExpiresAt = null;
    kyc.phoneOtpAttempts = 0;
    await this.kycRepository.saveKyc(kyc);

    return { message: 'Phone number verified' };
  }

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

  async getDocumentFile(
    id: string,
    fileKey: string,
  ): Promise<{ absolutePath: string; mimetype: string }> {
    const kyc = await this.kycRepository.findKycById(id);
    if (!kyc) {
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
