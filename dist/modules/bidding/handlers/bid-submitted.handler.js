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
var BidSubmittedHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BidSubmittedHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const uuid_1 = require("uuid");
const event_names_1 = require("../../../common/events/event-names");
const auction_broadcast_service_1 = require("../services/auction-broadcast.service");
let BidSubmittedHandler = BidSubmittedHandler_1 = class BidSubmittedHandler {
    auctionBroadcastService;
    logger = new common_1.Logger(BidSubmittedHandler_1.name);
    constructor(auctionBroadcastService) {
        this.auctionBroadcastService = auctionBroadcastService;
    }
    async handle(payload) {
        const jobId = (0, uuid_1.v4)();
        const startTime = Date.now();
        this.logger.log('Handling bid.submitted event', {
            jobId,
            productId: payload.productId,
            bidId: payload.bidId,
        });
        try {
            await this.auctionBroadcastService.broadcastUpdate(payload.productId);
            this.logger.log('bid.submitted handled', {
                jobId,
                productId: payload.productId,
                durationMs: Date.now() - startTime,
            });
        }
        catch (error) {
            this.logger.error('Failed to handle bid.submitted', {
                jobId,
                productId: payload.productId,
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
};
exports.BidSubmittedHandler = BidSubmittedHandler;
__decorate([
    (0, event_emitter_1.OnEvent)(event_names_1.EventNames.BID_SUBMITTED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BidSubmittedHandler.prototype, "handle", null);
exports.BidSubmittedHandler = BidSubmittedHandler = BidSubmittedHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auction_broadcast_service_1.AuctionBroadcastService])
], BidSubmittedHandler);
//# sourceMappingURL=bid-submitted.handler.js.map