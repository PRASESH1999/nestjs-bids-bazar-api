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
exports.KycRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const bank_detail_entity_1 = require("./entities/bank-detail.entity");
const kyc_verification_entity_1 = require("./entities/kyc-verification.entity");
let KycRepository = class KycRepository {
    dataSource;
    kycRepo;
    bankRepo;
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.kycRepo = this.dataSource.getRepository(kyc_verification_entity_1.KycVerification);
        this.bankRepo = this.dataSource.getRepository(bank_detail_entity_1.BankDetail);
    }
    createKyc(data) {
        return this.kycRepo.create(data);
    }
    async saveKyc(kyc) {
        return this.kycRepo.save(kyc);
    }
    async findKycByUserId(userId) {
        return this.kycRepo.findOneBy({ userId });
    }
    async findKycById(id) {
        return this.kycRepo.findOneBy({ id });
    }
    async findAllKycPaginated(page, limit, status) {
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
    createBank(data) {
        return this.bankRepo.create(data);
    }
    async saveBank(bank) {
        return this.bankRepo.save(bank);
    }
    async findBankByUserId(userId) {
        return this.bankRepo.findOneBy({ userId });
    }
};
exports.KycRepository = KycRepository;
exports.KycRepository = KycRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], KycRepository);
//# sourceMappingURL=kyc.repository.js.map