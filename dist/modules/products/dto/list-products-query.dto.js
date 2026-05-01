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
exports.ListProductsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const item_condition_enum_1 = require("../../../common/enums/item-condition.enum");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
class ListProductsQueryDto extends pagination_dto_1.PaginationDto {
    categoryId;
    subcategoryId;
    condition;
    keyword;
}
exports.ListProductsQueryDto = ListProductsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "categoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "subcategoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: item_condition_enum_1.ItemCondition }),
    (0, class_validator_1.IsEnum)(item_condition_enum_1.ItemCondition),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "condition", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Case-insensitive search on title and description',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListProductsQueryDto.prototype, "keyword", void 0);
//# sourceMappingURL=list-products-query.dto.js.map