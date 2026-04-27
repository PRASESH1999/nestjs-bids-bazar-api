import { DocumentType } from "../../../common/enums/document-type.enum";
import { AddressDto } from './address.dto';
import { BankDetailDto } from './bank-detail.dto';
export declare class SubmitKycDto {
    documentType: DocumentType;
    permanentAddress: AddressDto;
    temporaryAddress?: AddressDto;
    bankDetails: BankDetailDto;
}
