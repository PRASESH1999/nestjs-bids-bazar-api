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
exports.KycVerification = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("../../../common/entities/base.entity");
const document_type_enum_1 = require("../../../common/enums/document-type.enum");
const kyc_status_enum_1 = require("../../../common/enums/kyc-status.enum");
let KycVerification = class KycVerification extends base_entity_1.BaseEntity {
    userId;
    documentType;
    citizenshipFrontPath;
    citizenshipBackPath;
    passportPath;
    permanentAddress;
    temporaryAddress;
    status;
    rejectionReason;
    reviewedBy;
    reviewedAt;
};
exports.KycVerification = KycVerification;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'uuid', unique: true }),
    __metadata("design:type", String)
], KycVerification.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: document_type_enum_1.DocumentType }),
    __metadata("design:type", String)
], KycVerification.prototype, "documentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], KycVerification.prototype, "citizenshipFrontPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], KycVerification.prototype, "citizenshipBackPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], KycVerification.prototype, "passportPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], KycVerification.prototype, "permanentAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], KycVerification.prototype, "temporaryAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: kyc_status_enum_1.KycStatus, default: kyc_status_enum_1.KycStatus.PENDING }),
    __metadata("design:type", String)
], KycVerification.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], KycVerification.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], KycVerification.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], KycVerification.prototype, "reviewedAt", void 0);
exports.KycVerification = KycVerification = __decorate([
    (0, typeorm_1.Entity)('kyc_verifications')
], KycVerification);
//# sourceMappingURL=kyc-verification.entity.js.map