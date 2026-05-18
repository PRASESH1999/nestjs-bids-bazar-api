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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BiddingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BiddingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("typeorm");
const decimal_js_1 = __importDefault(require("decimal.js"));
const bid_payment_status_enum_1 = require("../../../common/enums/bid-payment-status.enum");
const product_status_enum_1 = require("../../../common/enums/product-status.enum");
const product_entity_1 = require("../../products/entities/product.entity");
const user_entity_1 = require("../../users/entities/user.entity");
const mail_service_1 = require("../../mail/mail.service");
const bid_entity_1 = require("../entities/bid.entity");
const list_bids_admin_query_dto_1 = require("../dto/list-bids-admin.query.dto");
let BiddingService = BiddingService_1 = class BiddingService {
    dataSource;
    configService;
    mailService;
    logger = new common_1.Logger(BiddingService_1.name);
    constructor(dataSource, configService, mailService) {
        this.dataSource = dataSource;
        this.configService = configService;
        this.mailService = mailService;
    }
    async placeBid(userId, productId, dto) {
        const qr = this.dataSource.createQueryRunner();
        await qr.connect();
        await qr.startTransaction();
        let previousHighestBidderId = null;
        let savedBid;
        let productOwnerId;
        let productTitle;
        let productId_;
        let biddingEndsAt;
        let wasFirstBid;
        let newBidAmount;
        let previousBidAmount;
        try {
            const product = await qr.manager
                .getRepository(product_entity_1.Product)
                .createQueryBuilder('product')
                .setLock('pessimistic_write')
                .where('product.id = :id', { id: productId })
                .getOne();
            if (!product) {
                throw new common_1.NotFoundException('Product not found');
            }
            if (product.status !== product_status_enum_1.ProductStatus.PENDING &&
                product.status !== product_status_enum_1.ProductStatus.ACTIVE) {
                throw new common_1.BadRequestException(`Bidding is not open for this product (status: ${product.status})`);
            }
            if (product.ownerId === userId) {
                throw new common_1.ForbiddenException('You cannot bid on your own product');
            }
            if (product.currentHighestBidderId !== null &&
                product.currentHighestBidderId === userId) {
                throw new common_1.ForbiddenException('You already hold the highest bid — wait for someone to outbid you before bidding again');
            }
            const range = this.computeValidBidRange(product);
            const bidAmount = new decimal_js_1.default(String(dto.amount));
            if (range.maxAmount === null) {
                if (bidAmount.lessThan(range.minAmount)) {
                    throw new common_1.BadRequestException(range.message);
                }
            }
            else {
                if (bidAmount.lessThan(range.minAmount) ||
                    bidAmount.greaterThan(range.maxAmount)) {
                    throw new common_1.BadRequestException(range.message);
                }
            }
            const now = new Date();
            previousHighestBidderId = product.currentHighestBidderId;
            productOwnerId = product.ownerId;
            productTitle = product.title;
            productId_ = product.id;
            previousBidAmount =
                product.currentHighestBid !== null
                    ? Number(product.currentHighestBid)
                    : null;
            const bid = qr.manager.getRepository(bid_entity_1.Bid).create({
                productId,
                bidderId: userId,
                amount: dto.amount,
                placedAt: now,
                previousHighestAmount: previousBidAmount,
                wasFirstBid: product.status === product_status_enum_1.ProductStatus.PENDING,
                paymentStatus: bid_payment_status_enum_1.BidPaymentStatus.NOT_RESPONSIBLE,
            });
            if (product.status === product_status_enum_1.ProductStatus.PENDING) {
                const biddingDurationHours = this.configService.getOrThrow('BIDDING_DURATION_HOURS');
                product.status = product_status_enum_1.ProductStatus.ACTIVE;
                product.biddingStartedAt = now;
                product.biddingEndsAt = new Date(now.getTime() + biddingDurationHours * 60 * 60 * 1000);
            }
            product.currentHighestBid = dto.amount;
            product.currentHighestBidderId = userId;
            savedBid = await qr.manager.getRepository(bid_entity_1.Bid).save(bid);
            await qr.manager.getRepository(product_entity_1.Product).save(product);
            biddingEndsAt = product.biddingEndsAt;
            wasFirstBid = savedBid.wasFirstBid;
            newBidAmount = Number(savedBid.amount);
            await qr.commitTransaction();
        }
        catch (err) {
            await qr.rollbackTransaction();
            throw err;
        }
        finally {
            await qr.release();
        }
        try {
            if (wasFirstBid) {
                const seller = await this.dataSource
                    .getRepository(user_entity_1.User)
                    .findOne({ where: { id: productOwnerId } });
                if (seller) {
                    await this.mailService.sendBidPlacedSeller(seller.email, {
                        sellerName: seller.name,
                        productTitle,
                        bidAmount: newBidAmount,
                        biddingEndsAt: biddingEndsAt,
                        productId: productId_,
                    });
                }
            }
            else if (previousHighestBidderId !== null &&
                previousHighestBidderId !== userId) {
                const previousBidder = await this.dataSource
                    .getRepository(user_entity_1.User)
                    .findOne({ where: { id: previousHighestBidderId } });
                if (previousBidder) {
                    await this.mailService.sendBidOutbid(previousBidder.email, {
                        bidderName: previousBidder.name,
                        productTitle,
                        yourBidAmount: previousBidAmount,
                        newHighestBid: newBidAmount,
                        biddingEndsAt: biddingEndsAt,
                        productId: productId_,
                    });
                }
            }
        }
        catch (err) {
            this.logger.error(`placeBid: post-commit email failed for product ${productId_}`, err instanceof Error ? err.stack : String(err));
        }
        return savedBid;
    }
    async getBidsForProduct(productId, viewerType) {
        const product = await this.dataSource
            .getRepository(product_entity_1.Product)
            .findOne({ where: { id: productId } });
        if (!product) {
            throw new common_1.NotFoundException('Product not found');
        }
        const bids = await this.dataSource
            .getRepository(bid_entity_1.Bid)
            .createQueryBuilder('bid')
            .leftJoinAndSelect('bid.bidder', 'bidder')
            .where('bid.productId = :productId', { productId })
            .orderBy('bid.placedAt', 'DESC')
            .getMany();
        if (viewerType === 'admin') {
            return bids.map((bid) => ({
                id: bid.id,
                amount: Number(bid.amount),
                placedAt: bid.placedAt.toISOString(),
                bidderId: bid.bidderId,
                bidderName: bid.bidder?.name ?? '',
                bidderEmail: bid.bidder?.email ?? '',
                paymentStatus: bid.paymentStatus,
                paymentDeadline: bid.paymentDeadline
                    ? bid.paymentDeadline.toISOString()
                    : null,
                isOriginalWinner: bid.isOriginalWinner,
                fallbackRank: bid.fallbackRank,
                isCurrentlyPaymentResponsible: bid.isCurrentlyPaymentResponsible,
            }));
        }
        return bids.map((bid) => ({
            id: bid.id,
            amount: Number(bid.amount),
            placedAt: bid.placedAt.toISOString(),
            bidderName: bid.bidder?.name ?? '',
        }));
    }
    async getMyBids(userId, query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const [bids, total] = await this.dataSource
            .getRepository(bid_entity_1.Bid)
            .createQueryBuilder('bid')
            .leftJoinAndSelect('bid.product', 'product')
            .where('bid.bidderId = :userId', { userId })
            .orderBy('bid.placedAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
        return {
            data: bids,
            meta: { page, limit, total },
        };
    }
    async listAllBids(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const sortBy = query.sortBy ?? 'placedAt';
        const sortOrder = query.sortOrder ?? list_bids_admin_query_dto_1.SortOrder.DESC;
        const qb = this.dataSource
            .getRepository(bid_entity_1.Bid)
            .createQueryBuilder('bid')
            .leftJoinAndSelect('bid.bidder', 'bidder')
            .leftJoinAndSelect('bid.product', 'product');
        if (query.productId) {
            qb.andWhere('bid.productId = :productId', { productId: query.productId });
        }
        if (query.bidderId) {
            qb.andWhere('bid.bidderId = :bidderId', { bidderId: query.bidderId });
        }
        if (query.paymentStatus) {
            qb.andWhere('bid.paymentStatus = :paymentStatus', {
                paymentStatus: query.paymentStatus,
            });
        }
        qb.orderBy(`bid.${sortBy}`, sortOrder);
        const [bids, total] = await qb
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
        return {
            data: bids,
            meta: { page, limit, total },
        };
    }
    computeValidBidRange(product) {
        if (product.status === product_status_enum_1.ProductStatus.PENDING) {
            const minAmount = new decimal_js_1.default(String(product.biddingStartPrice));
            return {
                minAmount,
                maxAmount: null,
                message: `First bid must be at least Rs. ${minAmount.toFixed(2)}`,
            };
        }
        const current = new decimal_js_1.default(String(product.currentHighestBid));
        const percentRaw = this.configService.getOrThrow('BID_INCREMENT_PERCENT');
        const flatRaw = this.configService.getOrThrow('BID_INCREMENT_MIN_FLAT');
        const incrementPercent = new decimal_js_1.default(String(percentRaw));
        const incrementFlat = new decimal_js_1.default(String(flatRaw));
        const percentInc = current.mul(incrementPercent).toDecimalPlaces(2);
        const minInc = incrementFlat;
        const maxInc = percentInc;
        let minAmount;
        let maxAmount;
        if (minInc.greaterThan(maxInc)) {
            minAmount = current.add(incrementFlat).toDecimalPlaces(2);
            maxAmount = minAmount;
        }
        else {
            minAmount = current.add(minInc).toDecimalPlaces(2);
            maxAmount = current.add(maxInc).toDecimalPlaces(2);
        }
        const message = minAmount.equals(maxAmount)
            ? `Bid must be exactly Rs. ${minAmount.toFixed(2)} (currently leading: Rs. ${current.toFixed(2)})`
            : `Bid must be between Rs. ${minAmount.toFixed(2)} and Rs. ${maxAmount.toFixed(2)} (currently leading: Rs. ${current.toFixed(2)})`;
        return { minAmount, maxAmount, message };
    }
};
exports.BiddingService = BiddingService;
exports.BiddingService = BiddingService = BiddingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        config_1.ConfigService,
        mail_service_1.MailService])
], BiddingService);
//# sourceMappingURL=bidding.service.js.map