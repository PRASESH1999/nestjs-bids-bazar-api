import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { KycStatus } from '@common/enums/kyc-status.enum';
import { BankDetail } from './entities/bank-detail.entity';
import { DocumentType } from '@common/enums/document-type.enum';
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

  /**
   * The submission holding a given identity document, if any.
   *
   * Scoped to the document type: citizenship, passport and NID numbers are
   * unrelated sequences, so the same digits under two types are two documents.
   * Mirrors the partial unique index on the entity.
   */
  async findByDocumentIdentity(
    documentType: DocumentType,
    documentId: string,
  ): Promise<KycVerification | null> {
    return this.kycRepo.findOneBy({ documentType, documentId });
  }

  async findKycById(id: string): Promise<KycVerification | null> {
    return this.kycRepo.findOneBy({ id });
  }

  async findAllKycPaginated(
    page: number,
    limit: number,
    status?: KycStatus,
    userId?: string,
  ): Promise<[KycVerification[], number]> {
    const qb = this.kycRepo.createQueryBuilder('kyc');
    if (status) {
      qb.andWhere('kyc.status = :status', { status });
    }
    if (userId) {
      qb.andWhere('kyc.userId = :userId', { userId });
    }
    return qb
      .orderBy('kyc.createdAt', 'ASC')
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
