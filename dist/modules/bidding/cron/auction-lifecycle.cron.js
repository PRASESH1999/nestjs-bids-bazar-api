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
var AuctionLifecycleCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionLifecycleCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const auction_lifecycle_service_1 = require("../services/auction-lifecycle.service");
let AuctionLifecycleCron = AuctionLifecycleCron_1 = class AuctionLifecycleCron {
    auctionLifecycleService;
    logger = new common_1.Logger(AuctionLifecycleCron_1.name);
    constructor(auctionLifecycleService) {
        this.auctionLifecycleService = auctionLifecycleService;
    }
    async closeExpiredAuctions() {
        const startedAt = Date.now();
        try {
            const result = await this.auctionLifecycleService.closeAllExpiredAuctions();
            this.logger.log(`[Cron] closeExpiredAuctions: processed=${result.processed}, ` +
                `errors=${result.errors}, durationMs=${Date.now() - startedAt}`);
        }
        catch (err) {
            this.logger.error(`[Cron] closeExpiredAuctions: uncaught error after ${Date.now() - startedAt}ms`, err instanceof Error ? err.stack : String(err));
        }
    }
    async expireOverduePayments() {
        const startedAt = Date.now();
        try {
            const result = await this.auctionLifecycleService.expireAllOverduePaymentWindows();
            this.logger.log(`[Cron] expireOverduePayments: processed=${result.processed}, ` +
                `errors=${result.errors}, durationMs=${Date.now() - startedAt}`);
        }
        catch (err) {
            this.logger.error(`[Cron] expireOverduePayments: uncaught error after ${Date.now() - startedAt}ms`, err instanceof Error ? err.stack : String(err));
        }
    }
    async sendPaymentWindowWarnings() {
        const startedAt = Date.now();
        try {
            const result = await this.auctionLifecycleService.sendPaymentWarnings();
            this.logger.log(`[Cron] sendPaymentWindowWarnings: sent=${result.sent}, ` +
                `errors=${result.errors}, durationMs=${Date.now() - startedAt}`);
        }
        catch (err) {
            this.logger.error(`[Cron] sendPaymentWindowWarnings: uncaught error after ${Date.now() - startedAt}ms`, err instanceof Error ? err.stack : String(err));
        }
    }
};
exports.AuctionLifecycleCron = AuctionLifecycleCron;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuctionLifecycleCron.prototype, "closeExpiredAuctions", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuctionLifecycleCron.prototype, "expireOverduePayments", null);
__decorate([
    (0, schedule_1.Cron)('0 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuctionLifecycleCron.prototype, "sendPaymentWindowWarnings", null);
exports.AuctionLifecycleCron = AuctionLifecycleCron = AuctionLifecycleCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auction_lifecycle_service_1.AuctionLifecycleService])
], AuctionLifecycleCron);
//# sourceMappingURL=auction-lifecycle.cron.js.map