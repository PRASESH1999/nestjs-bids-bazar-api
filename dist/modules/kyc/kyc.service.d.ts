import { EncryptionService } from "../../common/services/encryption.service";
import { StorageService } from "../../common/services/storage.service";
import { DocumentType } from "../../common/enums/document-type.enum";
import { KycStatus } from "../../common/enums/kyc-status.enum";
import { KycRepository } from './kyc.repository';
import { FindKycDto } from './dto/find-kyc.dto';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { MailService } from "../mail/mail.service";
import { UsersService } from "../users/users.service";
export interface KycFiles {
    citizenshipFront?: Express.Multer.File[];
    citizenshipBack?: Express.Multer.File[];
    passport?: Express.Multer.File[];
}
export declare class KycService {
    private readonly kycRepository;
    private readonly encryptionService;
    private readonly storageService;
    private readonly mailService;
    private readonly usersService;
    constructor(kycRepository: KycRepository, encryptionService: EncryptionService, storageService: StorageService, mailService: MailService, usersService: UsersService);
    submitKyc(userId: string, dto: SubmitKycDto, files: KycFiles): Promise<{
        id: string;
        status: KycStatus;
        message: string;
    }>;
    getMyKyc(userId: string): Promise<{
        id: string;
        status: KycStatus;
        documentType: DocumentType;
        citizenshipFrontUploaded: boolean;
        citizenshipBackUploaded: boolean;
        passportUploaded: boolean;
        permanentAddress: import("./entities/kyc-verification.entity").AddressData;
        temporaryAddress: import("./entities/kyc-verification.entity").AddressData | null;
        rejectionReason: string | null;
        reviewedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        bank: {
            bankName: string;
            accountHolderName: string;
            accountNumber: string;
        } | null;
        citizenshipFrontUrl: string | null;
        citizenshipBackUrl: string | null;
        passportUrl: string | null;
    } | null>;
    getAllKyc(query: FindKycDto): Promise<{
        data: {
            id: string;
            userId: string;
            status: KycStatus;
            documentType: DocumentType;
            rejectionReason: string | null;
            reviewedAt: Date | null;
            createdAt: Date;
            citizenshipFrontUrl: string | null;
            citizenshipBackUrl: string | null;
            passportUrl: string | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    getKycById(id: string): Promise<{
        id: string;
        userId: string;
        documentType: DocumentType;
        permanentAddress: import("./entities/kyc-verification.entity").AddressData;
        temporaryAddress: import("./entities/kyc-verification.entity").AddressData | null;
        status: KycStatus;
        rejectionReason: string | null;
        reviewedBy: string | null;
        reviewedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        citizenshipFrontUrl: string | null;
        citizenshipBackUrl: string | null;
        passportUrl: string | null;
    }>;
    reviewKyc(id: string, dto: ReviewKycDto, reviewerUserId: string): Promise<import("./entities/kyc-verification.entity").KycVerification>;
    getDecryptedBankDetails(kycId: string): Promise<{
        id: string;
        userId: string;
        bankName: string;
        accountHolderName: string;
        accountNumber: string;
        branch: string;
        swiftCode: string | null;
    }>;
    getDocumentFile(id: string, fileKey: string): Promise<{
        absolutePath: string;
        mimetype: string;
    }>;
    isVerified(userId: string): Promise<boolean>;
    private maskAccountNumber;
    private getVirtualDocumentUrl;
}
