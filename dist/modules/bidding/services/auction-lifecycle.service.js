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
var AuctionLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const bid_payment_status_enum_1 = require("../../../common/enums/bid-payment-status.enum");
const payment_confirmation_method_enum_1 = require("../../../common/enums/payment-confirmation-method.enum");
const product_status_enum_1 = require("../../../common/enums/product-status.enum");
const product_entity_1 = require("../../products/entities/product.entity");
const user_entity_1 = require("../../users/entities/user.entity");
const mail_service_1 = require("../../mail/mail.service");
const bid_entity_1 = require("../entities/bid.entity");
let AuctionLifecycleService = AuctionLifecycleService_1 = class AuctionLifecycleService {
    dataSource;
    configService;
    mailService;
    logger = new common_1.Logger(AuctionLifecycleService_1.name);
    constructor(dataSource, configService, mailService) {
        this.dataSource = dataSource;
        this.configService = configService;
        this.mailService = mailService;
    }
    async closeIfExpired(productId, externalQueryRunner) {
        const isOwnQr = externalQueryRunner === undefined;
        const qr = externalQueryRunner ?? this.dataSource.createQueryRunner();
        if (isOwnQr) {
            await qr.connect();
            await qr.startTransaction();
        }
        let winnerId = null;
        let sellerId = null;
        let winningAmount = null;
        let paymentDeadline = null;
        let capturedProductTitle = null;
        let capturedProductId = null;
        let transitioned = false;
        try {
            const product = await qr.manager
                .getRepository(product_entity_1.Product)
                .createQueryBuilder('product')
                .setLock('pessimistic_write')
                .where('product.id = :id', { id: productId })
                .getOne();
            if (!product || product.status !== product_status_enum_1.ProductStatus.ACTIVE) {
                if (isOwnQr)
                    await qr.commitTransaction();
                return;
            }
            const now = new Date();
            if (!product.biddingEndsAt || product.biddingEndsAt > now) {
                if (isOwnQr)
                    await qr.commitTransaction();
                return;
            }
            const highestBid = await qr.manager
                .getRepository(bid_entity_1.Bid)
                .createQueryBuilder('bid')
                .where('bid.productId = :productId', { productId })
                .orderBy('bid.amount', 'DESC')
                .addOrderBy('bid.placedAt', 'ASC')
                .getOne();
            if (!highestBid) {
                this.logger.warn(`closeIfExpired: ACTIVE product ${productId} has no bids — skipping transition`);
                if (isOwnQr)
                    await qr.commitTransaction();
                return;
            }
            const paymentWindowHours = this.configService.getOrThrow('PAYMENT_WINDOW_HOURS');
            const computedDeadline = new Date(now.getTime() + paymentWindowHours * 60 * 60 * 1000);
            highestBid.isOriginalWinner = true;
            highestBid.fallbackRank = 0;
            highestBid.isCurrentlyPaymentResponsible = true;
            highestBid.paymentStatus = bid_payment_status_enum_1.BidPaymentStatus.PENDING;
            highestBid.paymentDeadline = computedDeadline;
            product.status = product_status_enum_1.ProductStatus.AWAITING_PAYMENT;
            product.closedAt = now;
            product.winningBidId = highestBid.id;
            await qr.manager.getRepository(bid_entity_1.Bid).save(highestBid);
            await qr.manager.getRepository(product_entity_1.Product).save(product);
            if (isOwnQr)
                await qr.commitTransaction();
            winnerId = highestBid.bidderId;
            sellerId = product.ownerId;
            winningAmount = Number(highestBid.amount);
            paymentDeadline = computedDeadline;
            capturedProductTitle = product.title;
            capturedProductId = product.id;
            transitioned = true;
        }
        catch (err) {
            if (isOwnQr)
                await qr.rollbackTransaction();
            throw err;
        }
        finally {
            if (isOwnQr)
                await qr.release();
        }
        if (!transitioned)
            return;
        try {
            const [winner, seller] = await Promise.all([
                this.dataSource
                    .getRepository(user_entity_1.User)
                    .findOne({ where: { id: winnerId } }),
                this.dataSource
                    .getRepository(user_entity_1.User)
                    .findOne({ where: { id: sellerId } }),
            ]);
            if (winner) {
                await this.mailService.sendAuctionWon(winner.email, {
                    bidderName: winner.name,
                    productTitle: capturedProductTitle,
                    productId: capturedProductId,
                    winningAmount: winningAmount,
                    paymentDeadline: paymentDeadline,
                });
            }
            if (seller) {
                await this.mailService.sendAuctionClosedSeller(seller.email, {
                    sellerName: seller.name,
                    productTitle: capturedProductTitle,
                    winningAmount: winningAmount,
                    winnerName: winner?.name ?? 'Unknown',
                });
            }
        }
        catch (err) {
            this.logger.error(`closeIfExpired: post-commit email failed for product ${capturedProductId}`, err instanceof Error ? err.stack : String(err));
        }
    }
    async handlePaymentExpiry(productId, externalQueryRunner) {
        const isOwnQr = externalQueryRunner === undefined;
        const qr = externalQueryRunner ?? this.dataSource.createQueryRunner();
        if (isOwnQr) {
            await qr.connect();
            await qr.startTransaction();
        }
        let outcome = 'noop';
        let newWinnerId = null;
        let sellerId = null;
        let capturedProductTitle = null;
        let capturedProductId = null;
        let newWinnerAmount = null;
        let newWinnerDeadline = null;
        let newWinnerFallbackRank = null;
        let failedBidderRank = null;
        let totalBiddersCount = null;
        try {
            const product = await qr.manager
                .getRepository(product_entity_1.Product)
                .createQueryBuilder('product')
                .setLock('pessimistic_write')
                .where('product.id = :id', { id: productId })
                .getOne();
            if (!product || product.status !== product_status_enum_1.ProductStatus.AWAITING_PAYMENT) {
                if (isOwnQr)
                    await qr.commitTransaction();
                return;
            }
            const responsibleBid = await qr.manager.getRepository(bid_entity_1.Bid).findOne({
                where: { productId, isCurrentlyPaymentResponsible: true },
            });
            if (!responsibleBid) {
                if (isOwnQr)
                    await qr.commitTransaction();
                return;
            }
            const now = new Date();
            if (!responsibleBid.paymentDeadline ||
                responsibleBid.paymentDeadline > now) {
                if (isOwnQr)
                    await qr.commitTransaction();
                return;
            }
            failedBidderRank = responsibleBid.fallbackRank;
            responsibleBid.paymentStatus = bid_payment_status_enum_1.BidPaymentStatus.EXPIRED;
            responsibleBid.isCurrentlyPaymentResponsible = false;
            const nextBid = await qr.manager
                .getRepository(bid_entity_1.Bid)
                .createQueryBuilder('bid')
                .where('bid.productId = :productId AND bid.paymentStatus = :status AND bid.id != :id', {
                productId,
                status: bid_payment_status_enum_1.BidPaymentStatus.NOT_RESPONSIBLE,
                id: responsibleBid.id,
            })
                .orderBy('bid.amount', 'DESC')
                .addOrderBy('bid.placedAt', 'ASC')
                .getOne();
            if (nextBid) {
                const paymentWindowHours = this.configService.getOrThrow('PAYMENT_WINDOW_HOURS');
                const computedDeadline = new Date(now.getTime() + paymentWindowHours * 60 * 60 * 1000);
                nextBid.fallbackRank = responsibleBid.fallbackRank + 1;
                nextBid.isCurrentlyPaymentResponsible = true;
                nextBid.paymentStatus = bid_payment_status_enum_1.BidPaymentStatus.PENDING;
                nextBid.paymentDeadline = computedDeadline;
                await qr.manager.getRepository(bid_entity_1.Bid).save(responsibleBid);
                await qr.manager.getRepository(bid_entity_1.Bid).save(nextBid);
                if (isOwnQr)
                    await qr.commitTransaction();
                outcome = 'fallback';
                newWinnerId = nextBid.bidderId;
                sellerId = product.ownerId;
                newWinnerAmount = Number(nextBid.amount);
                newWinnerDeadline = computedDeadline;
                newWinnerFallbackRank = nextBid.fallbackRank;
                capturedProductTitle = product.title;
                capturedProductId = product.id;
            }
            else {
                product.status = product_status_enum_1.ProductStatus.ABANDONED;
                product.abandonedAt = now;
                await qr.manager.getRepository(bid_entity_1.Bid).save(responsibleBid);
                await qr.manager.getRepository(product_entity_1.Product).save(product);
                if (isOwnQr)
                    await qr.commitTransaction();
                outcome = 'abandoned';
                sellerId = product.ownerId;
                capturedProductTitle = product.title;
                capturedProductId = product.id;
                totalBiddersCount = await this.dataSource
                    .getRepository(bid_entity_1.Bid)
                    .createQueryBuilder('bid')
                    .select('COUNT(DISTINCT bid.bidderId)', 'cnt')
                    .where('bid.productId = :productId', { productId })
                    .getRawOne()
                    .then((row) => parseInt(row?.cnt ?? '0', 10));
            }
        }
        catch (err) {
            if (isOwnQr)
                await qr.rollbackTransaction();
            throw err;
        }
        finally {
            if (isOwnQr)
                await qr.release();
        }
        try {
            if (outcome === 'fallback') {
                const [newWinner, seller] = await Promise.all([
                    this.dataSource
                        .getRepository(user_entity_1.User)
                        .findOne({ where: { id: newWinnerId } }),
                    this.dataSource
                        .getRepository(user_entity_1.User)
                        .findOne({ where: { id: sellerId } }),
                ]);
                if (newWinner) {
                    await this.mailService.sendPaymentFailedFallback(newWinner.email, {
                        bidderName: newWinner.name,
                        productTitle: capturedProductTitle,
                        productId: capturedProductId,
                        winningAmount: newWinnerAmount,
                        paymentDeadline: newWinnerDeadline,
                        fallbackRank: newWinnerFallbackRank,
                    });
                }
                if (seller) {
                    await this.mailService.sendPaymentFailedSeller(seller.email, {
                        sellerName: seller.name,
                        productTitle: capturedProductTitle,
                        failedBidderRank: failedBidderRank,
                        newWinnerName: newWinner?.name ?? 'Unknown',
                        newWinnerBidAmount: newWinnerAmount,
                    });
                }
            }
            else {
                const seller = await this.dataSource
                    .getRepository(user_entity_1.User)
                    .findOne({ where: { id: sellerId } });
                if (seller) {
                    await this.mailService.sendAuctionAbandoned(seller.email, {
                        sellerName: seller.name,
                        productTitle: capturedProductTitle,
                        totalBidders: totalBiddersCount ?? 0,
                    });
                }
            }
        }
        catch (err) {
            this.logger.error(`handlePaymentExpiry: post-commit email failed for product ${capturedProductId}`, err instanceof Error ? err.stack : String(err));
        }
    }
    async confirmPaymentManual(adminId, productId) {
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        let sellerId = null;
        let buyerId = null;
        let confirmedAmount = null;
        let capturedProductTitle = null;
        let savedProduct;
        try {
            const product = await qr.manager
                .getRepository(product_entity_1.Product)
                .createQueryBuilder('product')
                .setLock('pessimistic_write')
                .where('product.id = :id', { id: productId })
                .getOne();
            if (!product) {
                throw new common_1.BadRequestException('Product not found');
            }
            if (product.status !== product_status_enum_1.ProductStatus.AWAITING_PAYMENT) {
                throw new common_1.BadRequestException('Product is not awaiting payment');
            }
            const responsibleBid = await qr.manager.getRepository(bid_entity_1.Bid).findOne({
                where: { productId, isCurrentlyPaymentResponsible: true },
            });
            if (!responsibleBid) {
                throw new common_1.InternalServerErrorException('No responsible bid found — data inconsistency');
            }
            const now = new Date();
            responsibleBid.paymentStatus = bid_payment_status_enum_1.BidPaymentStatus.CONFIRMED;
            responsibleBid.paymentConfirmedAt = now;
            responsibleBid.paymentConfirmedById = adminId;
            responsibleBid.paymentConfirmationMethod =
                payment_confirmation_method_enum_1.PaymentConfirmationMethod.ADMIN_MANUAL;
            product.status = product_status_enum_1.ProductStatus.SETTLED;
            product.settledAt = now;
            await qr.manager.getRepository(bid_entity_1.Bid).save(responsibleBid);
            await qr.manager
                .createQueryBuilder()
                .update(bid_entity_1.Bid)
                .set({ paymentStatus: bid_payment_status_enum_1.BidPaymentStatus.NOT_RESPONSIBLE })
                .where('productId = :productId AND id != :id', {
                productId,
                id: responsibleBid.id,
            })
                .execute();
            savedProduct = await qr.manager.getRepository(product_entity_1.Product).save(product);
            await qr.commitTransaction();
            sellerId = product.ownerId;
            buyerId = responsibleBid.bidderId;
            confirmedAmount = Number(responsibleBid.amount);
            capturedProductTitle = product.title;
        }
        catch (err) {
            await qr.rollbackTransaction();
            throw err;
        }
        finally {
            await qr.release();
        }
        try {
            const [seller, buyer] = await Promise.all([
                this.dataSource
                    .getRepository(user_entity_1.User)
                    .findOne({ where: { id: sellerId } }),
                this.dataSource.getRepository(user_entity_1.User).findOne({ where: { id: buyerId } }),
            ]);
            if (seller) {
                await this.mailService.sendPaymentConfirmedSeller(seller.email, {
                    sellerName: seller.name,
                    productTitle: capturedProductTitle,
                    amount: confirmedAmount,
                    buyerName: buyer?.name ?? 'Unknown',
                });
            }
            if (buyer) {
                await this.mailService.sendPaymentConfirmedBuyer(buyer.email, {
                    buyerName: buyer.name,
                    productTitle: capturedProductTitle,
                    amount: confirmedAmount,
                });
            }
        }
        catch (err) {
            this.logger.error(`confirmPaymentManual: post-commit email failed for product ${productId}`, err instanceof Error ? err.stack : String(err));
        }
        return savedProduct;
    }
    async closeAllExpiredAuctions() {
        const expiredProducts = await this.dataSource
            .getRepository(product_entity_1.Product)
            .createQueryBuilder('product')
            .where('product.status = :status', { status: product_status_enum_1.ProductStatus.ACTIVE })
            .andWhere('product.biddingEndsAt <= :now', { now: new Date() })
            .getMany();
        let processed = 0;
        let errors = 0;
        for (const product of expiredProducts) {
            try {
                await this.closeIfExpired(product.id);
                processed++;
            }
            catch (err) {
                errors++;
                this.logger.error(`closeAllExpiredAuctions: failed for product ${product.id}`, err instanceof Error ? err.stack : String(err));
            }
        }
        return { processed, errors };
    }
    async expireAllOverduePaymentWindows() {
        const overdueProducts = await this.dataSource
            .getRepository(product_entity_1.Product)
            .createQueryBuilder('product')
            .innerJoin(bid_entity_1.Bid, 'bid', 'bid.productId = product.id AND bid.isCurrentlyPaymentResponsible = :responsible AND bid.paymentDeadline <= :now', { responsible: true, now: new Date() })
            .where('product.status = :status', {
            status: product_status_enum_1.ProductStatus.AWAITING_PAYMENT,
        })
            .getMany();
        let processed = 0;
        let errors = 0;
        for (const product of overdueProducts) {
            try {
                await this.handlePaymentExpiry(product.id);
                processed++;
            }
            catch (err) {
                errors++;
                this.logger.error(`expireAllOverduePaymentWindows: failed for product ${product.id}`, err instanceof Error ? err.stack : String(err));
            }
        }
        return { processed, errors };
    }
    async sendPaymentWarnings() {
        const now = new Date();
        const lowerBound = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
        const upperBound = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);
        const pendingBids = await this.dataSource
            .getRepository(bid_entity_1.Bid)
            .createQueryBuilder('bid')
            .leftJoinAndSelect('bid.bidder', 'bidder')
            .innerJoinAndSelect('bid.product', 'product')
            .where('bid.paymentStatus = :status', {
            status: bid_payment_status_enum_1.BidPaymentStatus.PENDING,
        })
            .andWhere('bid.isCurrentlyPaymentResponsible = :responsible', {
            responsible: true,
        })
            .andWhere('bid.paymentDeadline >= :lowerBound', { lowerBound })
            .andWhere('bid.paymentDeadline <= :upperBound', { upperBound })
            .andWhere('bid.paymentWarningSentAt IS NULL')
            .getMany();
        let sent = 0;
        let errors = 0;
        for (const bid of pendingBids) {
            if (!bid.bidder || !bid.product || !bid.paymentDeadline)
                continue;
            const wasSent = await this.mailService.sendPaymentWindowExpiring(bid.bidder.email, {
                bidderName: bid.bidder.name,
                productTitle: bid.product.title,
                amount: Number(bid.amount),
                paymentDeadline: bid.paymentDeadline,
                productId: bid.productId,
            });
            if (wasSent) {
                bid.paymentWarningSentAt = new Date();
                try {
                    await this.dataSource.getRepository(bid_entity_1.Bid).save(bid);
                    sent++;
                }
                catch (saveErr) {
                    errors++;
                    this.logger.error(`sendPaymentWarnings: failed to persist paymentWarningSentAt for bid ${bid.id}`, saveErr instanceof Error ? saveErr.stack : String(saveErr));
                }
            }
            else {
                errors++;
            }
        }
        return { sent, errors };
    }
};
exports.AuctionLifecycleService = AuctionLifecycleService;
exports.AuctionLifecycleService = AuctionLifecycleService = AuctionLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        config_1.ConfigService,
        mail_service_1.MailService])
], AuctionLifecycleService);
//# sourceMappingURL=auction-lifecycle.service.js.map