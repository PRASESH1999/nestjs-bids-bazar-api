import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { KycStatus } from "../../common/enums/kyc-status.enum";
import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { KycService } from './kyc.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
export declare class KycController {
    private readonly kycService;
    constructor(kycService: KycService);
    submitKyc(req: RequestWithUser, dto: SubmitKycDto, files: {
        citizenshipFront?: Express.Multer.File[];
        citizenshipBack?: Express.Multer.File[];
        passport?: Express.Multer.File[];
    }): Promise<{
        id: string;
        status: KycStatus;
        message: string;
    }>;
    getMyKyc(req: RequestWithUser): Promise<{
        id: string;
        status: KycStatus;
        documentType: import("../../common/enums/document-type.enum").DocumentType;
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
    } | null>;
    getAllKyc(pagination: PaginationDto, status?: KycStatus): Promise<{
        data: {
            id: string;
            userId: string;
            status: KycStatus;
            documentType: import("../../common/enums/document-type.enum").DocumentType;
            rejectionReason: string | null;
            reviewedAt: Date | null;
            createdAt: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    getKycById(id: string): Promise<import("./entities/kyc-verification.entity").KycVerification>;
    reviewKyc(id: string, dto: ReviewKycDto, req: RequestWithUser): Promise<import("./entities/kyc-verification.entity").KycVerification>;
    getDecryptedBankDetails(id: string): Promise<{
        id: string;
        userId: string;
        bankName: string;
        accountHolderName: string;
        accountNumber: string;
        branch: string;
        swiftCode: string | null;
    }>;
    getDocument(id: string, fileKey: string, res: Response): Promise<StreamableFile>;
}
