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
exports.EncryptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
let EncryptionService = class EncryptionService {
    configService;
    key;
    constructor(configService) {
        this.configService = configService;
        const hexKey = this.configService.get('ENCRYPTION_KEY');
        if (!hexKey || hexKey.length !== 64) {
            throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32');
        }
        this.key = Buffer.from(hexKey, 'hex');
    }
    encrypt(plaintext) {
        const iv = (0, crypto_1.randomBytes)(12);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', this.key, iv);
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]).toString('base64');
    }
    decrypt(ciphertext) {
        const buf = Buffer.from(ciphertext, 'base64');
        const iv = buf.subarray(0, 12);
        const authTag = buf.subarray(12, 28);
        const encrypted = buf.subarray(28);
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', this.key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
    }
};
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EncryptionService);
//# sourceMappingURL=encryption.service.js.map