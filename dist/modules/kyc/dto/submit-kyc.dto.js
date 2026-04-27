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
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const document_type_enum_1 = require("../../../common/enums/document-type.enum");
const address_dto_1 = require("./address.dto");
const bank_detail_dto_1 = require("./bank-detail.dto");
function parseJsonField(value) {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    return value;
}
class SubmitKycDto {
    documentType;
    permanentAddress;
    temporaryAddress;
    bankDetails;
}
exports.SubmitKycDto = SubmitKycDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: document_type_enum_1.DocumentType }),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.IsEnum)(document_type_enum_1.DocumentType),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "documentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Permanent address as a JSON string in multipart forms',
        type: address_dto_1.AddressDto,
    }),
    (0, class_transformer_1.Transform)(({ value }) => parseJsonField(value)),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => address_dto_1.AddressDto),
    __metadata("design:type", address_dto_1.AddressDto)
], SubmitKycDto.prototype, "permanentAddress", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Temporary address as a JSON string in multipart forms',
        type: address_dto_1.AddressDto,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => parseJsonField(value)),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => address_dto_1.AddressDto),
    __metadata("design:type", address_dto_1.AddressDto)
], SubmitKycDto.prototype, "temporaryAddress", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Bank details as a JSON string in multipart forms',
        type: bank_detail_dto_1.BankDetailDto,
    }),
    (0, class_transformer_1.Transform)(({ value }) => parseJsonField(value)),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => bank_detail_dto_1.BankDetailDto),
    __metadata("design:type", bank_detail_dto_1.BankDetailDto)
], SubmitKycDto.prototype, "bankDetails", void 0);
//# sourceMappingURL=submit-kyc.dto.js.map