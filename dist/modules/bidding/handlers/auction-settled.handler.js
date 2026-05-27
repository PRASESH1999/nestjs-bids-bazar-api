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
var AuctionSettledHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionSettledHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const uuid_1 = require("uuid");
const event_names_1 = require("../../../common/events/event-names");
const auction_broadcast_service_1 = require("../services/auction-broadcast.service");
let AuctionSettledHandler = AuctionSettledHandler_1 = class AuctionSettledHandler {
    auctionBroadcastService;
    logger = new common_1.Logger(AuctionSettledHandler_1.name);
    constructor(auctionBroadcastService) {
        this.auctionBroadcastService = auctionBroadcastService;
    }
    async handle(payload) {
        const jobId = (0, uuid_1.v4)();
        const startTime = Date.now();
        this.logger.log('Handling auction.settled event', {
            jobId,
            productId: payload.productId,
            winningBidId: payload.winningBidId,
        });
        try {
            await this.auctionBroadcastService.broadcastUpdate(payload.productId);
            this.logger.log('auction.settled handled', {
                jobId,
                productId: payload.productId,
                durationMs: Date.now() - startTime,
            });
        }
        catch (error) {
            this.logger.error('Failed to handle auction.settled', {
                jobId,
                productId: payload.productId,
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
};
exports.AuctionSettledHandler = AuctionSettledHandler;
__decorate([
    (0, event_emitter_1.OnEvent)(event_names_1.EventNames.AUCTION_SETTLED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuctionSettledHandler.prototype, "handle", null);
exports.AuctionSettledHandler = AuctionSettledHandler = AuctionSettledHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auction_broadcast_service_1.AuctionBroadcastService])
], AuctionSettledHandler);
//# sourceMappingURL=auction-settled.handler.js.map