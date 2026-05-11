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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var BiddingController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiddingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const permission_enum_1 = require("../../common/enums/permission.enum");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const auction_lifecycle_service_1 = require("./services/auction-lifecycle.service");
const bidding_service_1 = require("./services/bidding.service");
const place_bid_dto_1 = require("./dto/place-bid.dto");
const list_bids_admin_query_dto_1 = require("./dto/list-bids-admin.query.dto");
let BiddingController = BiddingController_1 = class BiddingController {
    biddingService;
    auctionLifecycleService;
    logger = new common_1.Logger(BiddingController_1.name);
    constructor(biddingService, auctionLifecycleService) {
        this.biddingService = biddingService;
        this.auctionLifecycleService = auctionLifecycleService;
    }
    async placeBid(productId, dto, req) {
        try {
            await this.auctionLifecycleService.closeIfExpired(productId);
        }
        catch (err) {
            this.logger.warn(`Pre-bid closeIfExpired failed for product ${productId}: ` +
                `${err instanceof Error ? err.message : String(err)}`);
        }
        return this.biddingService.placeBid(req.user.sub, productId, dto);
    }
    async getBidsForProduct(productId, req) {
        const viewerType = req.user.permissions.includes(permission_enum_1.Permission.BID_VIEW_ALL)
            ? 'admin'
            : 'authenticated';
        return this.biddingService.getBidsForProduct(productId, viewerType);
    }
    async getMyBids(req, query) {
        return this.biddingService.getMyBids(req.user.sub, query);
    }
    async adminGetBidsForProduct(productId) {
        return this.biddingService.getBidsForProduct(productId, 'admin');
    }
    async confirmPayment(productId, req) {
        return this.auctionLifecycleService.confirmPaymentManual(req.user.sub, productId);
    }
    async listAllBids(query) {
        return this.biddingService.listAllBids(query);
    }
};
exports.BiddingController = BiddingController;
__decorate([
    (0, common_1.Post)('products/:id/bids'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.BID_PLACE),
    (0, swagger_1.ApiOperation)({
        summary: 'Place a bid on a product (email-verified USER only)',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, place_bid_dto_1.PlaceBidDto, Object]),
    __metadata("design:returntype", Promise)
], BiddingController.prototype, "placeBid", null);
__decorate([
    (0, common_1.Get)('products/:id/bids'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.BID_VIEW_OWN),
    (0, swagger_1.ApiOperation)({
        summary: 'Get bid history for a product. Admins receive full metadata; users see names only.',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BiddingController.prototype, "getBidsForProduct", null);
__decorate([
    (0, common_1.Get)('bids/me'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.BID_VIEW_OWN),
    (0, swagger_1.ApiOperation)({ summary: "Get the authenticated user's own bid history" }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], BiddingController.prototype, "getMyBids", null);
__decorate([
    (0, common_1.Get)('admin/products/:id/bids'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.BID_VIEW_ALL),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin: get full bid history for a product (includes emails and metadata)',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BiddingController.prototype, "adminGetBidsForProduct", null);
__decorate([
    (0, common_1.Post)('admin/products/:id/confirm-payment'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PAYMENT_CONFIRM_MANUAL),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin: manually confirm payment for the currently-responsible bid, settling the auction',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BiddingController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Get)('admin/bids'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.BID_VIEW_ALL),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin: list all bids with optional filters and pagination',
    }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_bids_admin_query_dto_1.ListBidsAdminQueryDto]),
    __metadata("design:returntype", Promise)
], BiddingController.prototype, "listAllBids", null);
exports.BiddingController = BiddingController = BiddingController_1 = __decorate([
    (0, swagger_1.ApiTags)('bidding'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [bidding_service_1.BiddingService,
        auction_lifecycle_service_1.AuctionLifecycleService])
], BiddingController);
//# sourceMappingURL=bidding.controller.js.map