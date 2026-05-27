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
exports.PendingEmailChange = void 0;
const typeorm_1 = require("typeorm");
let PendingEmailChange = class PendingEmailChange {
    id;
    userId;
    newEmail;
    tokenHash;
    expiresAt;
    createdAt;
};
exports.PendingEmailChange = PendingEmailChange;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PendingEmailChange.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_pending_email_changes_user_id', { unique: true }),
    (0, typeorm_1.Column)({ type: 'uuid', name: 'user_id', unique: true }),
    __metadata("design:type", String)
], PendingEmailChange.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, name: 'new_email' }),
    __metadata("design:type", String)
], PendingEmailChange.prototype, "newEmail", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_pending_email_changes_token_hash'),
    (0, typeorm_1.Column)({ type: 'varchar', name: 'token_hash' }),
    __metadata("design:type", String)
], PendingEmailChange.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'expires_at' }),
    __metadata("design:type", Date)
], PendingEmailChange.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], PendingEmailChange.prototype, "createdAt", void 0);
exports.PendingEmailChange = PendingEmailChange = __decorate([
    (0, typeorm_1.Entity)('pending_email_changes')
], PendingEmailChange);
//# sourceMappingURL=pending-email-change.entity.js.map