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
exports.AdminListProductsQueryDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const product_status_enum_1 = require("../../../common/enums/product-status.enum");
const list_products_query_dto_1 = require("./list-products-query.dto");
class AdminListProductsQueryDto extends list_products_query_dto_1.ListProductsQueryDto {
    status;
    ownerId;
}
exports.AdminListProductsQueryDto = AdminListProductsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: product_status_enum_1.ProductStatus }),
    (0, class_validator_1.IsEnum)(product_status_enum_1.ProductStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdminListProductsQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdminListProductsQueryDto.prototype, "ownerId", void 0);
//# sourceMappingURL=admin-list-products-query.dto.js.map