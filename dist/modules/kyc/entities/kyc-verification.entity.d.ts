import { BaseEntity } from "../../../common/entities/base.entity";
import { DocumentType } from "../../../common/enums/document-type.enum";
import { KycStatus } from "../../../common/enums/kyc-status.enum";
export interface AddressData {
    street: string;
    city: string;
    district: string;
    province: string;
    country: string;
}
export declare class KycVerification extends BaseEntity {
    userId: string;
    documentType: DocumentType;
    citizenshipFrontPath: string | null;
    citizenshipBackPath: string | null;
    passportPath: string | null;
    permanentAddress: AddressData;
    temporaryAddress: AddressData | null;
    status: KycStatus;
    rejectionReason: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
}
