import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { BankDetail } from './entities/bank-detail.entity';
import { KycVerification } from './entities/kyc-verification.entity';

@Injectable()
export class KycRepository {
  private readonly kycRepo: Repository<KycVerification>;
  private readonly bankRepo: Repository<BankDetail>;

  constructor(private readonly dataSource: DataSource) {
    this.kycRepo = this.dataSource.getRepository(KycVerification);
    this.bankRepo = this.dataSource.getRepository(BankDetail);
  }

  createKyc(data: Partial<KycVerification>): KycVerification {
    return this.kycRepo.create(data);
  }

  async saveKyc(kyc: KycVerification): Promise<KycVerification> {
    return this.kycRepo.save(kyc);
  }

  async findKycByUserId(userId: string): Promise<KycVerification | null> {
    return this.kycRepo.findOneBy({ userId });
  }

  async findKycById(id: string): Promise<KycVerification | null> {
    return this.kycRepo.findOneBy({ id });
  }

  async findAllKycPaginated(
    page: number,
    limit: number,
    status?: KycStatus,
  ): Promise<[KycVerification[], number]> {
    const qb = this.kycRepo.createQueryBuilder('kyc');
    if (status) {
      qb.where('kyc.status = :status', { status });
    }
    return qb
      .orderBy('kyc.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  createBank(data: Partial<BankDetail>): BankDetail {
    return this.bankRepo.create(data);
  }

  async saveBank(bank: BankDetail): Promise<BankDetail> {
    return this.bankRepo.save(bank);
  }

  async findBankByUserId(userId: string): Promise<BankDetail | null> {
    return this.bankRepo.findOneBy({ userId });
  }
}
