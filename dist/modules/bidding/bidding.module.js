"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiddingModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const users_module_1 = require("../users/users.module");
const product_entity_1 = require("../products/entities/product.entity");
const bid_entity_1 = require("./entities/bid.entity");
const bidding_controller_1 = require("./bidding.controller");
const bidding_service_1 = require("./services/bidding.service");
const auction_lifecycle_service_1 = require("./services/auction-lifecycle.service");
const auction_lifecycle_cron_1 = require("./cron/auction-lifecycle.cron");
let BiddingModule = class BiddingModule {
};
exports.BiddingModule = BiddingModule;
exports.BiddingModule = BiddingModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([bid_entity_1.Bid, product_entity_1.Product]), users_module_1.UsersModule],
        controllers: [bidding_controller_1.BiddingController],
        providers: [bidding_service_1.BiddingService, auction_lifecycle_service_1.AuctionLifecycleService, auction_lifecycle_cron_1.AuctionLifecycleCron],
        exports: [auction_lifecycle_service_1.AuctionLifecycleService],
    })
], BiddingModule);
//# sourceMappingURL=bidding.module.js.map