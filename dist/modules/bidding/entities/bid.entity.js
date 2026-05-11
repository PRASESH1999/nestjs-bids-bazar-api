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
exports.Bid = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("../../../common/entities/base.entity");
const bid_payment_status_enum_1 = require("../../../common/enums/bid-payment-status.enum");
const payment_confirmation_method_enum_1 = require("../../../common/enums/payment-confirmation-method.enum");
const product_entity_1 = require("../../products/entities/product.entity");
const user_entity_1 = require("../../users/entities/user.entity");
let Bid = class Bid extends base_entity_1.BaseEntity {
    productId;
    product;
    bidderId;
    bidder;
    amount;
    placedAt;
    previousHighestAmount;
    wasFirstBid;
    isOriginalWinner;
    fallbackRank;
    isCurrentlyPaymentResponsible;
    paymentStatus;
    paymentDeadline;
    paymentConfirmedAt;
    paymentConfirmedById;
    paymentConfirmationMethod;
    paymentWarningSentAt;
};
exports.Bid = Bid;
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Bid.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, {
        onDelete: 'RESTRICT',
        nullable: false,
        eager: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'productId' }),
    __metadata("design:type", product_entity_1.Product)
], Bid.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Bid.prototype, "bidderId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: false, eager: false }),
    (0, typeorm_1.JoinColumn)({ name: 'bidderId' }),
    __metadata("design:type", user_entity_1.User)
], Bid.prototype, "bidder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], Bid.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], Bid.prototype, "placedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], Bid.prototype, "previousHighestAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Bid.prototype, "wasFirstBid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Bid.prototype, "isOriginalWinner", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Bid.prototype, "fallbackRank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Bid.prototype, "isCurrentlyPaymentResponsible", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: bid_payment_status_enum_1.BidPaymentStatus,
        default: bid_payment_status_enum_1.BidPaymentStatus.NOT_RESPONSIBLE,
    }),
    __metadata("design:type", String)
], Bid.prototype, "paymentStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Bid.prototype, "paymentDeadline", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Bid.prototype, "paymentConfirmedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Bid.prototype, "paymentConfirmedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: payment_confirmation_method_enum_1.PaymentConfirmationMethod, nullable: true }),
    __metadata("design:type", Object)
], Bid.prototype, "paymentConfirmationMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Bid.prototype, "paymentWarningSentAt", void 0);
exports.Bid = Bid = __decorate([
    (0, typeorm_1.Entity)('bids'),
    (0, typeorm_1.Index)(['productId', 'amount']),
    (0, typeorm_1.Index)(['bidderId', 'placedAt']),
    (0, typeorm_1.Index)(['paymentStatus', 'paymentDeadline']),
    (0, typeorm_1.Index)(['productId', 'fallbackRank']),
    (0, typeorm_1.Index)(['productId'], {
        where: '"isCurrentlyPaymentResponsible" = true',
        unique: true,
    })
], Bid);
//# sourceMappingURL=bid.entity.js.map