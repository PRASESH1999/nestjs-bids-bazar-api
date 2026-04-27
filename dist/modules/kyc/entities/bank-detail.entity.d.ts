import { BaseEntity } from "../../../common/entities/base.entity";
export declare class BankDetail extends BaseEntity {
    userId: string;
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    branch: string;
    swiftCode: string | null;
}
