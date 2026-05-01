"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWNER_EDITABLE_STATUSES = exports.PUBLICLY_VISIBLE_STATUSES = exports.ProductStatus = void 0;
var ProductStatus;
(function (ProductStatus) {
    ProductStatus["DRAFT"] = "DRAFT";
    ProductStatus["SUBMITTED"] = "SUBMITTED";
    ProductStatus["REJECTED"] = "REJECTED";
    ProductStatus["APPROVED"] = "APPROVED";
    ProductStatus["PENDING"] = "PENDING";
    ProductStatus["ACTIVE"] = "ACTIVE";
    ProductStatus["CLOSED"] = "CLOSED";
    ProductStatus["AWAITING_PAYMENT"] = "AWAITING_PAYMENT";
    ProductStatus["SETTLED"] = "SETTLED";
    ProductStatus["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    ProductStatus["ABANDONED"] = "ABANDONED";
    ProductStatus["WITHDRAWN"] = "WITHDRAWN";
})(ProductStatus || (exports.ProductStatus = ProductStatus = {}));
exports.PUBLICLY_VISIBLE_STATUSES = [
    ProductStatus.PENDING,
    ProductStatus.ACTIVE,
    ProductStatus.CLOSED,
    ProductStatus.AWAITING_PAYMENT,
    ProductStatus.SETTLED,
];
exports.OWNER_EDITABLE_STATUSES = [
    ProductStatus.DRAFT,
    ProductStatus.REJECTED,
];
//# sourceMappingURL=product-status.enum.js.map