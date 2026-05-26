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
exports.PasswordResetRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const password_reset_token_entity_1 = require("./entities/password-reset-token.entity");
let PasswordResetRepository = class PasswordResetRepository {
    dataSource;
    repo;
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.repo = this.dataSource.getRepository(password_reset_token_entity_1.PasswordResetToken);
    }
    async softDeleteByUserId(userId) {
        await this.repo.softDelete({ userId });
    }
    async saveToken(userId, tokenHash, expiresAt, queryRunner) {
        const repo = queryRunner
            ? queryRunner.manager.getRepository(password_reset_token_entity_1.PasswordResetToken)
            : this.repo;
        const token = repo.create({ userId, tokenHash, expiresAt });
        return repo.save(token);
    }
    async findByTokenHash(tokenHash) {
        return this.repo.findOneBy({ tokenHash });
    }
    async deleteById(id, queryRunner) {
        const repo = queryRunner
            ? queryRunner.manager.getRepository(password_reset_token_entity_1.PasswordResetToken)
            : this.repo;
        await repo.delete({ id });
    }
    async countRequestsSince(userId, since) {
        return this.repo
            .createQueryBuilder('prt')
            .withDeleted()
            .where('prt.user_id = :userId', { userId })
            .andWhere('prt.created_at >= :since', { since })
            .getCount();
    }
    async deleteExpiredBefore(cutoff) {
        const result = await this.dataSource
            .createQueryBuilder()
            .delete()
            .from(password_reset_token_entity_1.PasswordResetToken)
            .where('expires_at < :cutoff', { cutoff })
            .execute();
        return result.affected ?? 0;
    }
};
exports.PasswordResetRepository = PasswordResetRepository;
exports.PasswordResetRepository = PasswordResetRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], PasswordResetRepository);
//# sourceMappingURL=password-reset.repository.js.map