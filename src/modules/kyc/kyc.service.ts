import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EncryptionService } from '@common/services/encryption.service';
import { StorageService } from '@common/services/storage.service';
import { DocumentType } from '@common/enums/document-type.enum';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { PaginationDto } from '@common/dto/pagination.dto';
import { KycRepository } from './kyc.repository';
import { ReviewAction, ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { MailService } from '@modules/mail/mail.service';
import { UsersService } from '@modules/users/users.service';

export interface KycFiles {
  citizenshipFront?: Express.Multer.File[];
  citizenshipBack?: Express.Multer.File[];
  passport?: Express.Multer.File[];
}

@Injectable()
export class KycService {
  constructor(
    private readonly kycRepository: KycRepository,
    private readonly encryptionService: EncryptionService,
    private readonly storageService: StorageService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
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

    if (dto.documentType === DocumentType.CITIZENSHIP) {
      if (!front || !back) {
        throw new BadRequestException(
          'Both citizenshipFront and citizenshipBack files are required for CITIZENSHIP',
        );
      }
    } else {
      if (!passport) {
        throw new BadRequestException(
          'A passport file is required for PASSPORT',
        );
      }
    }

    // Delete old files when resubmitting after REJECTED
    if (existing) {
      const oldPaths = [
        existing.citizenshipFrontPath,
        existing.citizenshipBackPath,
        existing.passportPath,
      ].filter((p): p is string => p !== null);
      await Promise.all(oldPaths.map((p) => this.storageService.deleteFile(p)));
    }

    // Persist new files
    let citizenshipFrontPath: string | null = null;
    let citizenshipBackPath: string | null = null;
    let passportPath: string | null = null;

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
    } else {
      passportPath = await this.storageService.saveFile(
        passport!,
        userId,
        'passport',
      );
    }

    // Encrypt sensitive bank fields
    const encryptedAccountNumber = this.encryptionService.encrypt(dto.accountNumber);
    const encryptedBranch = this.encryptionService.encrypt(dto.branch);
    const encryptedSwiftCode = dto.swiftCode
      ? this.encryptionService.encrypt(dto.swiftCode)
      : null;

    // Save KYC record (update on resubmission, create otherwise)
    const kycPayload = {
      userId,
      documentType: dto.documentType,
      citizenshipFrontPath,
      citizenshipBackPath,
      passportPath,
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

    // Save bank details (update on resubmission, create otherwise)
    const existingBank = await this.kycRepository.findBankByUserId(userId);
    const bankPayload = {
      userId,
      bankName: dto.bankName,
      accountHolderName: dto.accountHolderName,
      accountNumber: encryptedAccountNumber,
      branch: encryptedBranch,
      swiftCode: encryptedSwiftCode,
    };

    if (existingBank) {
      Object.assign(existingBank, bankPayload);
      await this.kycRepository.saveBank(existingBank);
    } else {
      await this.kycRepository.saveBank(
        this.kycRepository.createBank(bankPayload),
      );
    }

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
      permanentAddress: kyc.permanentAddress,
      temporaryAddress: kyc.temporaryAddress,
      rejectionReason: kyc.rejectionReason,
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
    };
  }

  async getAllKyc(pagination: PaginationDto, status?: KycStatus) {
    const { page = 1, limit = 20 } = pagination;
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
      reviewedAt: kyc.reviewedAt,
      createdAt: kyc.createdAt,
    }));

    return { data, meta: { page, limit, total } };
  }

  async getKycById(id: string) {
    const kyc = await this.kycRepository.findKycById(id);
    if (!kyc) {
      throw new NotFoundException('KYC record not found');
    }
    return kyc;
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
    };

    if (!(fileKey in pathMap)) {
      throw new NotFoundException(
        `Invalid document key '${fileKey}'. Valid keys: citizenshipFront, citizenshipBack, passport`,
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
}
