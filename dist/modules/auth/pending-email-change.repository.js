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
exports.PendingEmailChangeRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const pending_email_change_entity_1 = require("./entities/pending-email-change.entity");
let PendingEmailChangeRepository = class PendingEmailChangeRepository {
    dataSource;
    repo;
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.repo = this.dataSource.getRepository(pending_email_change_entity_1.PendingEmailChange);
    }
    async deleteByUserId(userId) {
        await this.repo.delete({ userId });
    }
    async saveRecord(userId, newEmail, tokenHash, expiresAt) {
        const record = this.repo.create({ userId, newEmail, tokenHash, expiresAt });
        await this.repo.save(record);
    }
    async findByTokenHash(tokenHash) {
        return this.repo.findOne({ where: { tokenHash } });
    }
    async deleteById(id, queryRunner) {
        if (queryRunner) {
            await queryRunner.manager.delete(pending_email_change_entity_1.PendingEmailChange, { id });
        }
        else {
            await this.repo.delete({ id });
        }
    }
    async deleteExpiredBefore(cutoff) {
        const result = await this.dataSource
            .createQueryBuilder()
            .delete()
            .from(pending_email_change_entity_1.PendingEmailChange)
            .where('expires_at < :cutoff', { cutoff })
            .execute();
        return result.affected ?? 0;
    }
};
exports.PendingEmailChangeRepository = PendingEmailChangeRepository;
exports.PendingEmailChangeRepository = PendingEmailChangeRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], PendingEmailChangeRepository);
//# sourceMappingURL=pending-email-change.repository.js.map