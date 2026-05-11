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
exports.ListBidsAdminQueryDto = exports.SortOrder = exports.BidSortBy = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const pagination_dto_1 = require("../../../common/dto/pagination.dto");
const bid_payment_status_enum_1 = require("../../../common/enums/bid-payment-status.enum");
var BidSortBy;
(function (BidSortBy) {
    BidSortBy["AMOUNT"] = "amount";
    BidSortBy["PLACED_AT"] = "placedAt";
    BidSortBy["PAYMENT_STATUS"] = "paymentStatus";
})(BidSortBy || (exports.BidSortBy = BidSortBy = {}));
var SortOrder;
(function (SortOrder) {
    SortOrder["ASC"] = "ASC";
    SortOrder["DESC"] = "DESC";
})(SortOrder || (exports.SortOrder = SortOrder = {}));
class ListBidsAdminQueryDto extends pagination_dto_1.PaginationDto {
    productId;
    bidderId;
    paymentStatus;
    sortBy = BidSortBy.PLACED_AT;
    sortOrder = SortOrder.DESC;
}
exports.ListBidsAdminQueryDto = ListBidsAdminQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by product UUID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListBidsAdminQueryDto.prototype, "productId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by bidder UUID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ListBidsAdminQueryDto.prototype, "bidderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: bid_payment_status_enum_1.BidPaymentStatus,
        description: 'Filter by payment status',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(bid_payment_status_enum_1.BidPaymentStatus),
    __metadata("design:type", String)
], ListBidsAdminQueryDto.prototype, "paymentStatus", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: BidSortBy, default: BidSortBy.PLACED_AT }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(BidSortBy),
    (0, class_transformer_1.Type)(() => String),
    __metadata("design:type", String)
], ListBidsAdminQueryDto.prototype, "sortBy", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: SortOrder, default: SortOrder.DESC }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(SortOrder),
    (0, class_transformer_1.Type)(() => String),
    __metadata("design:type", String)
], ListBidsAdminQueryDto.prototype, "sortOrder", void 0);
//# sourceMappingURL=list-bids-admin.query.dto.js.map