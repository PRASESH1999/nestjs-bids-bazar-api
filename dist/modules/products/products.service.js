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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const product_status_enum_1 = require("../../common/enums/product-status.enum");
const kyc_service_1 = require("../kyc/kyc.service");
const users_service_1 = require("../users/users.service");
const categories_service_1 = require("../categories/categories.service");
const mail_service_1 = require("../mail/mail.service");
const products_repository_1 = require("./products.repository");
const product_storage_service_1 = require("./product-storage.service");
const AUCTION_ACTIVE_STATUSES = [
    product_status_enum_1.ProductStatus.ACTIVE,
    product_status_enum_1.ProductStatus.CLOSED,
    product_status_enum_1.ProductStatus.AWAITING_PAYMENT,
    product_status_enum_1.ProductStatus.SETTLED,
    product_status_enum_1.ProductStatus.PAYMENT_FAILED,
    product_status_enum_1.ProductStatus.ABANDONED,
];
let ProductsService = class ProductsService {
    productsRepository;
    productStorage;
    kycService;
    usersService;
    categoriesService;
    mailService;
    constructor(productsRepository, productStorage, kycService, usersService, categoriesService, mailService) {
        this.productsRepository = productsRepository;
        this.productStorage = productStorage;
        this.kycService = kycService;
        this.usersService = usersService;
        this.categoriesService = categoriesService;
        this.mailService = mailService;
    }
    async createProduct(userId, dto, imageFiles) {
        await this.assertKycApproved(userId);
        await this.assertCategoryAndSubcategory(dto.categoryId, dto.subcategoryId);
        if (!imageFiles || imageFiles.length === 0) {
            throw new common_1.BadRequestException('At least one product image is required');
        }
        if (imageFiles.length > 8) {
            throw new common_1.BadRequestException('A product can have at most 8 images');
        }
        this.productStorage.validateFiles(imageFiles);
        const biddingStartPrice = this.computeBiddingStartPrice(dto.basePrice);
        const product = this.productsRepository.createProduct({
            ownerId: userId,
            title: dto.title,
            description: dto.description,
            categoryId: dto.categoryId,
            subcategoryId: dto.subcategoryId,
            condition: dto.condition,
            basePrice: dto.basePrice,
            biddingStartPrice,
            biddingDurationHours: dto.biddingDurationHours ?? 72,
            status: product_status_enum_1.ProductStatus.DRAFT,
            currentHighestBid: null,
            currentHighestBidderId: null,
            biddingStartedAt: null,
            biddingEndsAt: null,
            submittedAt: null,
            reviewedById: null,
            reviewedAt: null,
            rejectionReason: null,
            locationProvince: null,
            locationDistrict: null,
            locationArea: null,
            withdrawnAt: null,
        });
        const savedProduct = await this.productsRepository.saveProduct(product);
        const imageMeta = await this.productStorage.saveProductImages(savedProduct.id, imageFiles);
        const images = imageMeta.map((meta) => this.productsRepository.createImage({
            productId: savedProduct.id,
            ...meta,
        }));
        await this.productsRepository.saveImages(images);
        return this.productsRepository.findById(savedProduct.id);
    }
    async updateProduct(userId, productId, dto, newImageFiles) {
        const product = await this.findOwnedProduct(userId, productId);
        this.assertEditable(product);
        if (dto.categoryId || dto.subcategoryId) {
            await this.assertCategoryAndSubcategory(dto.categoryId ?? product.categoryId, dto.subcategoryId ?? product.subcategoryId);
        }
        if (dto.title !== undefined)
            product.title = dto.title;
        if (dto.description !== undefined)
            product.description = dto.description;
        if (dto.categoryId !== undefined)
            product.categoryId = dto.categoryId;
        if (dto.subcategoryId !== undefined)
            product.subcategoryId = dto.subcategoryId;
        if (dto.condition !== undefined)
            product.condition = dto.condition;
        if (dto.biddingDurationHours !== undefined)
            product.biddingDurationHours = dto.biddingDurationHours;
        if (dto.basePrice !== undefined) {
            product.basePrice = dto.basePrice;
            product.biddingStartPrice = this.computeBiddingStartPrice(dto.basePrice);
        }
        if (newImageFiles && newImageFiles.length > 0) {
            if (newImageFiles.length > 8) {
                throw new common_1.BadRequestException('A product can have at most 8 images');
            }
            this.productStorage.validateFiles(newImageFiles);
            const oldImages = await this.productsRepository.findImagesByProductId(productId);
            await this.productStorage.deleteProductImages(oldImages);
            await this.productsRepository.deleteImagesByProductId(productId);
            const imageMeta = await this.productStorage.saveProductImages(productId, newImageFiles);
            const images = imageMeta.map((meta) => this.productsRepository.createImage({ productId, ...meta }));
            await this.productsRepository.saveImages(images);
        }
        await this.productsRepository.saveProduct(product);
        return this.productsRepository.findById(productId);
    }
    async submitProduct(userId, productId) {
        const product = await this.findOwnedProduct(userId, productId);
        this.assertEditable(product);
        const images = await this.productsRepository.findImagesByProductId(productId);
        if (images.length === 0) {
            throw new common_1.BadRequestException('Product must have at least one image before submitting');
        }
        if (product.status === product_status_enum_1.ProductStatus.REJECTED) {
            product.rejectionReason = null;
            product.reviewedById = null;
            product.reviewedAt = null;
        }
        product.status = product_status_enum_1.ProductStatus.SUBMITTED;
        product.submittedAt = new Date();
        const saved = await this.productsRepository.saveProduct(product);
        const user = await this.usersService.findById(userId);
        if (user) {
            await this.mailService.sendProductSubmitted(user.email, user.name, saved.title);
        }
        return saved;
    }
    async withdrawProduct(userId, productId) {
        const product = await this.findOwnedProduct(userId, productId);
        if (AUCTION_ACTIVE_STATUSES.includes(product.status)) {
            throw new common_1.BadRequestException('Cannot withdraw a product once bidding has started');
        }
        const withdrawableStatuses = [
            product_status_enum_1.ProductStatus.DRAFT,
            product_status_enum_1.ProductStatus.SUBMITTED,
            product_status_enum_1.ProductStatus.REJECTED,
            product_status_enum_1.ProductStatus.APPROVED,
            product_status_enum_1.ProductStatus.PENDING,
        ];
        if (!withdrawableStatuses.includes(product.status)) {
            throw new common_1.BadRequestException('Cannot withdraw product in its current status');
        }
        product.status = product_status_enum_1.ProductStatus.WITHDRAWN;
        product.withdrawnAt = new Date();
        await this.productsRepository.saveProduct(product);
    }
    async deleteProduct(userId, productId) {
        const product = await this.findOwnedProduct(userId, productId);
        this.assertEditable(product);
        const images = await this.productsRepository.findImagesByProductId(productId);
        await this.productStorage.deleteProductImages(images);
        await this.productsRepository.deleteProduct(product);
    }
    async listMyProducts(userId, query) {
        const { page = 1, limit = 20, ...filters } = query;
        const [data, total] = await this.productsRepository.findPaginated(page, limit, {
            ...filters,
            ownerId: userId,
        });
        return { data, meta: { page, limit, total } };
    }
    async listPublicProducts(query) {
        const { page = 1, limit = 20, ...filters } = query;
        const [data, total] = await this.productsRepository.findPaginated(page, limit, {
            ...filters,
            statuses: product_status_enum_1.PUBLICLY_VISIBLE_STATUSES,
        });
        return { data, meta: { page, limit, total } };
    }
    async getPublicProductById(id) {
        const product = await this.productsRepository.findById(id);
        if (!product || !product_status_enum_1.PUBLICLY_VISIBLE_STATUSES.includes(product.status)) {
            throw new common_1.NotFoundException('Product not found');
        }
        return product;
    }
    async getProductImageFile(imageId, requesterId, requesterIsAdmin) {
        const image = await this.productsRepository.findImageById(imageId);
        if (!image)
            throw new common_1.NotFoundException('Image not found');
        const product = await this.productsRepository.findByIdWithoutImages(image.productId);
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        const isPubliclyVisible = product_status_enum_1.PUBLICLY_VISIBLE_STATUSES.includes(product.status);
        const isOwner = requesterId === product.ownerId;
        if (!isPubliclyVisible && !isOwner && !requesterIsAdmin) {
            throw new common_1.NotFoundException('Product not found');
        }
        return {
            absolutePath: this.productStorage.getAbsolutePath(image.filePath),
            mimeType: image.mimeType,
        };
    }
    async getProductForOwnerOrAdmin(userId, productId, isAdmin) {
        const product = await this.productsRepository.findById(productId);
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        if (!isAdmin && product.ownerId !== userId) {
            throw new common_1.NotFoundException('Product not found');
        }
        return product;
    }
    async listAllProducts(query) {
        const { page = 1, limit = 20, status, ownerId, ...filters } = query;
        const [data, total] = await this.productsRepository.findPaginatedWithOwner(page, limit, { ...filters, status, ownerId });
        return { data, meta: { page, limit, total } };
    }
    async approveProduct(adminId, productId) {
        const product = await this.productsRepository.findByIdWithoutImages(productId);
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        if (product.status !== product_status_enum_1.ProductStatus.SUBMITTED) {
            throw new common_1.BadRequestException('Only products in SUBMITTED status can be approved');
        }
        product.status = product_status_enum_1.ProductStatus.PENDING;
        product.reviewedById = adminId;
        product.reviewedAt = new Date();
        const saved = await this.productsRepository.saveProduct(product);
        const owner = await this.usersService.findById(product.ownerId);
        if (owner) {
            await this.mailService.sendProductApproved(owner.email, owner.name, saved.title);
        }
        return saved;
    }
    async rejectProduct(adminId, productId, dto) {
        const product = await this.productsRepository.findByIdWithoutImages(productId);
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        if (product.status !== product_status_enum_1.ProductStatus.SUBMITTED) {
            throw new common_1.BadRequestException('Only products in SUBMITTED status can be rejected');
        }
        product.status = product_status_enum_1.ProductStatus.REJECTED;
        product.rejectionReason = dto.rejectionReason;
        product.reviewedById = adminId;
        product.reviewedAt = new Date();
        const saved = await this.productsRepository.saveProduct(product);
        const owner = await this.usersService.findById(product.ownerId);
        if (owner) {
            await this.mailService.sendProductRejected(owner.email, owner.name, saved.title, dto.rejectionReason);
        }
        return saved;
    }
    async assertKycApproved(userId) {
        const verified = await this.kycService.isVerified(userId);
        if (!verified) {
            throw new common_1.ForbiddenException('KYC verification required to sell products. Please complete and submit your KYC.');
        }
    }
    async assertCategoryAndSubcategory(categoryId, subcategoryId) {
        const category = await this.categoriesService.getCategoryById(categoryId);
        if (!category.isActive) {
            throw new common_1.BadRequestException('Selected category is not active');
        }
        const subcategory = await this.categoriesService.getSubcategoryById(subcategoryId);
        if (!subcategory.isActive) {
            throw new common_1.BadRequestException('Selected subcategory is not active');
        }
        if (subcategory.categoryId !== categoryId) {
            throw new common_1.BadRequestException('Subcategory does not belong to the selected category');
        }
    }
    async findOwnedProduct(userId, productId) {
        const product = await this.productsRepository.findByIdWithoutImages(productId);
        if (!product)
            throw new common_1.NotFoundException('Product not found');
        if (product.ownerId !== userId) {
            throw new common_1.ForbiddenException('You do not own this product');
        }
        return product;
    }
    assertEditable(product) {
        if (!product_status_enum_1.OWNER_EDITABLE_STATUSES.includes(product.status)) {
            throw new common_1.BadRequestException('Cannot edit product in its current status. Only DRAFT or REJECTED products can be edited.');
        }
    }
    computeBiddingStartPrice(basePrice) {
        return Math.round(basePrice * 1.1 * 100) / 100;
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [products_repository_1.ProductsRepository,
        product_storage_service_1.ProductStorageService,
        kyc_service_1.KycService,
        users_service_1.UsersService,
        categories_service_1.CategoriesService,
        mail_service_1.MailService])
], ProductsService);
//# sourceMappingURL=products.service.js.map