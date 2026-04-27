"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycService = void 0;
const common_1 = require("@nestjs/common");
const encryption_service_1 = require("../../common/services/encryption.service");
const storage_service_1 = require("../../common/services/storage.service");
const document_type_enum_1 = require("../../common/enums/document-type.enum");
const kyc_status_enum_1 = require("../../common/enums/kyc-status.enum");
const kyc_repository_1 = require("./kyc.repository");
const review_kyc_dto_1 = require("./dto/review-kyc.dto");
const mail_service_1 = require("../mail/mail.service");
const users_service_1 = require("../users/users.service");
let KycService = class KycService {
    kycRepository;
    encryptionService;
    storageService;
    mailService;
    usersService;
    constructor(kycRepository, encryptionService, storageService, mailService, usersService) {
        this.kycRepository = kycRepository;
        this.encryptionService = encryptionService;
        this.storageService = storageService;
        this.mailService = mailService;
        this.usersService = usersService;
    }
    async submitKyc(userId, dto, files) {
        const existing = await this.kycRepository.findKycByUserId(userId);
        if (existing?.status === kyc_status_enum_1.KycStatus.PENDING) {
            throw new common_1.ConflictException('Your KYC is already under review');
        }
        if (existing?.status === kyc_status_enum_1.KycStatus.APPROVED) {
            throw new common_1.ConflictException('Your KYC has already been approved');
        }
        const front = files.citizenshipFront?.[0];
        const back = files.citizenshipBack?.[0];
        const passport = files.passport?.[0];
        if (dto.documentType === document_type_enum_1.DocumentType.CITIZENSHIP) {
            if (!front || !back) {
                throw new common_1.BadRequestException('Both citizenshipFront and citizenshipBack files are required for CITIZENSHIP');
            }
        }
        else {
            if (!passport) {
                throw new common_1.BadRequestException('A passport file is required for PASSPORT');
            }
        }
        if (existing) {
            const oldPaths = [
                existing.citizenshipFrontPath,
                existing.citizenshipBackPath,
                existing.passportPath,
            ].filter((p) => p !== null);
            await Promise.all(oldPaths.map((p) => this.storageService.deleteFile(p)));
        }
        let citizenshipFrontPath = null;
        let citizenshipBackPath = null;
        let passportPath = null;
        if (dto.documentType === document_type_enum_1.DocumentType.CITIZENSHIP) {
            citizenshipFrontPath = await this.storageService.saveFile(front, userId, 'citizenship-front');
            citizenshipBackPath = await this.storageService.saveFile(back, userId, 'citizenship-back');
        }
        else {
            passportPath = await this.storageService.saveFile(passport, userId, 'passport');
        }
        const encryptedAccountNumber = this.encryptionService.encrypt(dto.accountNumber);
        const encryptedBranch = this.encryptionService.encrypt(dto.branch);
        const encryptedSwiftCode = dto.swiftCode
            ? this.encryptionService.encrypt(dto.swiftCode)
            : null;
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
            status: kyc_status_enum_1.KycStatus.PENDING,
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
        };
        let kyc;
        if (existing) {
            Object.assign(existing, kycPayload);
            kyc = await this.kycRepository.saveKyc(existing);
        }
        else {
            kyc = await this.kycRepository.saveKyc(this.kycRepository.createKyc(kycPayload));
        }
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
        }
        else {
            await this.kycRepository.saveBank(this.kycRepository.createBank(bankPayload));
        }
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
    async getMyKyc(userId) {
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
                    accountNumber: this.maskAccountNumber(this.encryptionService.decrypt(bank.accountNumber)),
                }
                : null,
        };
    }
    async getAllKyc(pagination, status) {
        const { page = 1, limit = 20 } = pagination;
        const [records, total] = await this.kycRepository.findAllKycPaginated(page, limit, status);
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
    async getKycById(id) {
        const kyc = await this.kycRepository.findKycById(id);
        if (!kyc) {
            throw new common_1.NotFoundException('KYC record not found');
        }
        return kyc;
    }
    async reviewKyc(id, dto, reviewerUserId) {
        const kyc = await this.kycRepository.findKycById(id);
        if (!kyc) {
            throw new common_1.NotFoundException('KYC record not found');
        }
        if (dto.action === review_kyc_dto_1.ReviewAction.REJECT && !dto.rejectionReason) {
            throw new common_1.BadRequestException('rejectionReason is required when rejecting a KYC submission');
        }
        kyc.status =
            dto.action === review_kyc_dto_1.ReviewAction.APPROVE
                ? kyc_status_enum_1.KycStatus.APPROVED
                : kyc_status_enum_1.KycStatus.REJECTED;
        kyc.reviewedBy = reviewerUserId;
        kyc.reviewedAt = new Date();
        kyc.rejectionReason =
            dto.action === review_kyc_dto_1.ReviewAction.REJECT ? (dto.rejectionReason ?? null) : null;
        const updatedKyc = await this.kycRepository.saveKyc(kyc);
        const user = await this.usersService.findById(kyc.userId);
        if (user) {
            if (dto.action === review_kyc_dto_1.ReviewAction.APPROVE) {
                await this.mailService.sendKycApproved(user.email, user.name);
            }
            else {
                await this.mailService.sendKycRejected(user.email, user.name, dto.rejectionReason);
            }
        }
        return updatedKyc;
    }
    async getDecryptedBankDetails(kycId) {
        const kyc = await this.kycRepository.findKycById(kycId);
        if (!kyc) {
            throw new common_1.NotFoundException('KYC record not found');
        }
        const bank = await this.kycRepository.findBankByUserId(kyc.userId);
        if (!bank) {
            throw new common_1.NotFoundException('Bank details not found for this KYC record');
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
    async getDocumentFile(id, fileKey) {
        const kyc = await this.kycRepository.findKycById(id);
        if (!kyc) {
            throw new common_1.NotFoundException('KYC record not found');
        }
        const pathMap = {
            citizenshipFront: kyc.citizenshipFrontPath,
            citizenshipBack: kyc.citizenshipBackPath,
            passport: kyc.passportPath,
        };
        if (!(fileKey in pathMap)) {
            throw new common_1.NotFoundException(`Invalid document key '${fileKey}'. Valid keys: citizenshipFront, citizenshipBack, passport`);
        }
        const relativePath = pathMap[fileKey];
        if (!relativePath) {
            throw new common_1.NotFoundException(`Document '${fileKey}' was not uploaded for this KYC record`);
        }
        const ext = relativePath.split('.').pop()?.toLowerCase() ?? '';
        const MIME_MAP = {
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
    async isVerified(userId) {
        const kyc = await this.kycRepository.findKycByUserId(userId);
        return kyc?.status === kyc_status_enum_1.KycStatus.APPROVED;
    }
    maskAccountNumber(accountNumber) {
        if (accountNumber.length <= 4)
            return accountNumber;
        return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
    }
};
exports.KycService = KycService;
exports.KycService = KycService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [kyc_repository_1.KycRepository,
        encryption_service_1.EncryptionService,
        storage_service_1.StorageService,
        mail_service_1.MailService,
        users_service_1.UsersService])
], KycService);
//# sourceMappingURL=kyc.service.js.map