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
var AuctionBroadcastService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionBroadcastService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const rxjs_1 = require("rxjs");
const product_entity_1 = require("../../products/entities/product.entity");
const bid_entity_1 = require("../entities/bid.entity");
const bidding_service_1 = require("./bidding.service");
let AuctionBroadcastService = AuctionBroadcastService_1 = class AuctionBroadcastService {
    dataSource;
    biddingService;
    logger = new common_1.Logger(AuctionBroadcastService_1.name);
    subject = new rxjs_1.Subject();
    constructor(dataSource, biddingService) {
        this.dataSource = dataSource;
        this.biddingService = biddingService;
    }
    streamFor(productId) {
        return this.subject.asObservable().pipe((0, rxjs_1.filter)((msg) => msg.productId === productId), (0, rxjs_1.map)((msg) => ({ data: msg.payload })));
    }
    async buildPayload(productId) {
        const product = await this.dataSource
            .getRepository(product_entity_1.Product)
            .findOne({ where: { id: productId } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        const topBidders = await this.biddingService.getTopBiddersForProduct(productId);
        const recentBids = await this.fetchRecentBids(productId);
        return {
            type: 'auction.update',
            productId: product.id,
            status: product.status,
            currentHighestBid: product.currentHighestBid !== null
                ? Number(product.currentHighestBid)
                : null,
            currentHighestBidderId: product.currentHighestBidderId,
            biddingEndsAt: product.biddingEndsAt
                ? product.biddingEndsAt.toISOString()
                : null,
            topBidders,
            recentBids,
        };
    }
    async broadcastUpdate(productId) {
        const payload = await this.buildPayload(productId);
        this.subject.next({ productId, payload });
        this.logger.debug(`broadcastUpdate: pushed update for product ${productId}`);
    }
    async fetchRecentBids(productId) {
        const rows = await this.dataSource
            .getRepository(bid_entity_1.Bid)
            .createQueryBuilder('bid')
            .innerJoin('bid.bidder', 'bidder')
            .select('bidder.username', 'username')
            .addSelect('bid.amount', 'amount')
            .addSelect('bid.placedAt', 'placedAt')
            .where('bid.productId = :productId', { productId })
            .orderBy('bid.placedAt', 'DESC')
            .limit(5)
            .getRawMany();
        return rows.map((row) => ({
            username: row.username,
            amount: Number(row.amount),
            placedAt: new Date(row.placedAt).toISOString(),
        }));
    }
};
exports.AuctionBroadcastService = AuctionBroadcastService;
exports.AuctionBroadcastService = AuctionBroadcastService = AuctionBroadcastService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        bidding_service_1.BiddingService])
], AuctionBroadcastService);
//# sourceMappingURL=auction-broadcast.service.js.map