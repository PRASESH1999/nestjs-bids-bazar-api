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
exports.PasswordResetToken = void 0;
const typeorm_1 = require("typeorm");
let PasswordResetToken = class PasswordResetToken {
    id;
    userId;
    tokenHash;
    expiresAt;
    createdAt;
    deletedAt;
};
exports.PasswordResetToken = PasswordResetToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PasswordResetToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_password_reset_tokens_user_id'),
    (0, typeorm_1.Column)({ type: 'uuid', name: 'user_id' }),
    __metadata("design:type", String)
], PasswordResetToken.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_password_reset_tokens_token_hash'),
    (0, typeorm_1.Column)({ type: 'varchar', name: 'token_hash' }),
    __metadata("design:type", String)
], PasswordResetToken.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_password_reset_tokens_expires_at'),
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'expires_at' }),
    __metadata("design:type", Date)
], PasswordResetToken.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], PasswordResetToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: 'timestamptz', name: 'deleted_at', nullable: true }),
    __metadata("design:type", Object)
], PasswordResetToken.prototype, "deletedAt", void 0);
exports.PasswordResetToken = PasswordResetToken = __decorate([
    (0, typeorm_1.Entity)('password_reset_tokens')
], PasswordResetToken);
//# sourceMappingURL=password-reset-token.entity.js.map