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
exports.SubmitKycDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const document_type_enum_1 = require("../../../common/enums/document-type.enum");
class SubmitKycDto {
    documentType;
    permanentAddressStreet;
    permanentAddressCity;
    permanentAddressDistrict;
    permanentAddressProvince;
    permanentAddressCountry;
    temporaryAddressStreet;
    temporaryAddressCity;
    temporaryAddressDistrict;
    temporaryAddressProvince;
    temporaryAddressCountry;
    bankName;
    accountHolderName;
    accountNumber;
    branch;
    swiftCode;
    citizenshipFront;
    citizenshipBack;
    passport;
}
exports.SubmitKycDto = SubmitKycDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: document_type_enum_1.DocumentType }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsEnum)(document_type_enum_1.DocumentType),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "documentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Kathmandu-10' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "permanentAddressStreet", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Kathmandu' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "permanentAddressCity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Kathmandu' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "permanentAddressDistrict", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Bagmati' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "permanentAddressProvince", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Nepal', default: 'Nepal' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "permanentAddressCountry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Lalitpur-3' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "temporaryAddressStreet", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Lalitpur' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "temporaryAddressCity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Lalitpur' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "temporaryAddressDistrict", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Bagmati' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "temporaryAddressProvince", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Nepal' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "temporaryAddressCountry", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Nepal Bank' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'John Doe' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "accountHolderName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '1234567890',
        description: '9–20 digit account number',
    }),
    (0, class_validator_1.Matches)(/^\d{9,20}$/, { message: 'accountNumber must be 9–20 digits' }),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "accountNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Kathmandu Branch' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "branch", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'NBLNNPKA' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "swiftCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'binary',
        description: 'Required when documentType is CITIZENSHIP',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], SubmitKycDto.prototype, "citizenshipFront", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'binary',
        description: 'Required when documentType is CITIZENSHIP',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], SubmitKycDto.prototype, "citizenshipBack", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: 'string',
        format: 'binary',
        description: 'Required when documentType is PASSPORT',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], SubmitKycDto.prototype, "passport", void 0);
//# sourceMappingURL=submit-kyc.dto.js.map