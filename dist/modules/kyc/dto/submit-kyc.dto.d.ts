import { DocumentType } from "../../../common/enums/document-type.enum";
export declare class SubmitKycDto {
    documentType: DocumentType;
    permanentAddressStreet: string;
    permanentAddressCity: string;
    permanentAddressDistrict: string;
    permanentAddressProvince: string;
    permanentAddressCountry?: string;
    temporaryAddressStreet?: string;
    temporaryAddressCity?: string;
    temporaryAddressDistrict?: string;
    temporaryAddressProvince?: string;
    temporaryAddressCountry?: string;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    branch: string;
    swiftCode?: string;
    citizenshipFront?: any;
    citizenshipBack?: any;
    passport?: any;
}
