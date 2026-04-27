import { DataSource } from 'typeorm';
import { KycStatus } from "../../common/enums/kyc-status.enum";
import { BankDetail } from './entities/bank-detail.entity';
import { KycVerification } from './entities/kyc-verification.entity';
export declare class KycRepository {
    private readonly dataSource;
    private readonly kycRepo;
    private readonly bankRepo;
    constructor(dataSource: DataSource);
    createKyc(data: Partial<KycVerification>): KycVerification;
    saveKyc(kyc: KycVerification): Promise<KycVerification>;
    findKycByUserId(userId: string): Promise<KycVerification | null>;
    findKycById(id: string): Promise<KycVerification | null>;
    findAllKycPaginated(page: number, limit: number, status?: KycStatus): Promise<[KycVerification[], number]>;
    createBank(data: Partial<BankDetail>): BankDetail;
    saveBank(bank: BankDetail): Promise<BankDetail>;
    findBankByUserId(userId: string): Promise<BankDetail | null>;
}
