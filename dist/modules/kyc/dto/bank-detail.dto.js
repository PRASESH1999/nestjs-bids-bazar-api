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
exports.BankDetailDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class BankDetailDto {
    bankName;
    accountHolderName;
    accountNumber;
    branch;
    swiftCode;
}
exports.BankDetailDto = BankDetailDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Nepal Investment Bank' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BankDetailDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'John Doe' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BankDetailDto.prototype, "accountHolderName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0123456789', description: '9–20 digit account number' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^\d{9,20}$/, { message: 'accountNumber must be 9–20 digits' }),
    __metadata("design:type", String)
], BankDetailDto.prototype, "accountNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Thamel Branch' }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BankDetailDto.prototype, "branch", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'NIBLNPKT' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BankDetailDto.prototype, "swiftCode", void 0);
//# sourceMappingURL=bank-detail.dto.js.map