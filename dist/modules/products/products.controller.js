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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const item_condition_enum_1 = require("../../common/enums/item-condition.enum");
const fs_1 = require("fs");
const multer_1 = require("multer");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const optional_jwt_guard_1 = require("../../common/guards/optional-jwt.guard");
const permission_enum_1 = require("../../common/enums/permission.enum");
const role_enum_1 = require("../../common/enums/role.enum");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const products_service_1 = require("./products.service");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const reject_product_dto_1 = require("./dto/reject-product.dto");
const set_preview_image_dto_1 = require("./dto/set-preview-image.dto");
const reorder_images_dto_1 = require("./dto/reorder-images.dto");
const list_products_query_dto_1 = require("./dto/list-products-query.dto");
const admin_list_products_query_dto_1 = require("./dto/admin-list-products-query.dto");
const multerOptions = { storage: (0, multer_1.memoryStorage)() };
let ProductsController = class ProductsController {
    productsService;
    constructor(productsService) {
        this.productsService = productsService;
    }
    async listPublicProducts(query) {
        return this.productsService.listPublicProducts(query);
    }
    calculateBiddingPrice(basePrice) {
        const price = parseFloat(basePrice);
        if (isNaN(price) || price <= 0) {
            throw new common_1.BadRequestException('basePrice must be a positive number');
        }
        const biddingStartPrice = this.productsService.computeBiddingStartPrice(price);
        return { basePrice: price, biddingStartPrice };
    }
    async listMyProducts(req, query) {
        return this.productsService.listMyProducts(req.user.sub, query);
    }
    async getPublicProduct(id, req) {
        const requesterId = req.user?.sub ?? null;
        return this.productsService.getPublicProductById(id, requesterId);
    }
    async getProductImage(productId, imageId, req, res) {
        const requesterId = req.user?.sub ?? null;
        const isAdmin = req.user?.role === role_enum_1.Role.ADMIN ||
            req.user?.role ===
                role_enum_1.Role.SUPERADMIN;
        const { absolutePath, mimeType } = await this.productsService.getProductImageFile(productId, imageId, requesterId, isAdmin);
        if (!(0, fs_1.existsSync)(absolutePath)) {
            throw new common_1.NotFoundException('Image file not found on server');
        }
        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': 'inline',
        });
        return new common_1.StreamableFile((0, fs_1.createReadStream)(absolutePath));
    }
    async createProduct(req, dto, files) {
        return this.productsService.createProduct(req.user.sub, dto, files ?? []);
    }
    async updateProduct(req, id, dto, files) {
        return this.productsService.updateProduct(req.user.sub, id, dto, files?.length ? files : undefined);
    }
    async submitProduct(req, id) {
        return this.productsService.submitProduct(req.user.sub, id);
    }
    async withdrawProduct(req, id) {
        await this.productsService.withdrawProduct(req.user.sub, id);
        return { message: 'Product withdrawn successfully' };
    }
    async deleteProduct(req, id) {
        await this.productsService.deleteProduct(req.user.sub, id);
        return { message: 'Product deleted successfully' };
    }
    async reorderImages(req, id, dto) {
        return this.productsService.reorderImages(id, dto.imageIds, req.user.sub, false);
    }
    async setPreviewImage(req, id, dto) {
        return this.productsService.setPreviewImage(id, dto.previewImageId, req.user.sub, false);
    }
    async listAllProducts(query) {
        return this.productsService.listAllProducts(query);
    }
    async getAdminProduct(req, id) {
        return this.productsService.getProductForOwnerOrAdmin(req.user.sub, id, true);
    }
    async approveProduct(req, id) {
        return this.productsService.approveProduct(req.user.sub, id);
    }
    async rejectProduct(req, id, dto) {
        return this.productsService.rejectProduct(req.user.sub, id, dto);
    }
    async adminReorderImages(req, id, dto) {
        return this.productsService.reorderImages(id, dto.imageIds, req.user.sub, true);
    }
    async adminSetPreviewImage(req, id, dto) {
        return this.productsService.setPreviewImage(id, dto.previewImageId, req.user.sub, true);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Get)('products'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'List publicly visible products' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_products_query_dto_1.ListProductsQueryDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "listPublicProducts", null);
__decorate([
    (0, common_1.Get)('products/calculate-bidding-price'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Calculate the bidding start price for a given base price',
    }),
    __param(0, (0, common_1.Query)('basePrice')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "calculateBiddingPrice", null);
__decorate([
    (0, common_1.Get)('products/me'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_VIEW_OWN),
    (0, swagger_1.ApiOperation)({ summary: 'List own products (all statuses)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_products_query_dto_1.ListProductsQueryDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "listMyProducts", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtGuard),
    (0, swagger_1.ApiOperation)({
        summary: 'Get a product by ID (owner can view own product regardless of status)',
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getPublicProduct", null);
__decorate([
    (0, common_1.Get)('products/:id/images/:imageId'),
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(optional_jwt_guard_1.OptionalJwtGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Stream a product image file' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('imageId')),
    __param(2, (0, common_1.Request)()),
    __param(3, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getProductImage", null);
__decorate([
    (0, common_1.Post)('products'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_CREATE),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new product listing (KYC required)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            required: [
                'title',
                'description',
                'categoryId',
                'subcategoryId',
                'condition',
                'basePrice',
            ],
            properties: {
                title: { type: 'string', minLength: 5, maxLength: 150 },
                description: { type: 'string', minLength: 20, maxLength: 5000 },
                specifications: {
                    type: 'string',
                    maxLength: 5000,
                    description: 'Plain-text product specifications (optional)',
                },
                categoryId: { type: 'string', format: 'uuid' },
                subcategoryId: { type: 'string', format: 'uuid' },
                condition: { type: 'string', enum: Object.values(item_condition_enum_1.ItemCondition) },
                basePrice: { type: 'number', minimum: 1 },
                biddingDurationHours: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 720,
                    default: 72,
                },
                previewImageIndex: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 7,
                    default: 0,
                    description: 'Zero-based index of the image to use as the preview thumbnail',
                },
                images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Product images (up to 8)',
                },
            },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('images', 8, multerOptions)),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_product_dto_1.CreateProductDto, Array]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MANAGE_OWN),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Update own product (DRAFT or REJECTED only)' }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                title: { type: 'string', minLength: 5, maxLength: 150 },
                description: { type: 'string', minLength: 20, maxLength: 5000 },
                specifications: {
                    type: 'string',
                    maxLength: 5000,
                    description: 'Plain-text product specifications (optional)',
                },
                categoryId: { type: 'string', format: 'uuid' },
                subcategoryId: { type: 'string', format: 'uuid' },
                condition: { type: 'string', enum: Object.values(item_condition_enum_1.ItemCondition) },
                basePrice: { type: 'number', minimum: 1 },
                biddingDurationHours: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 720,
                    default: 72,
                },
                previewImageIndex: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 7,
                    default: 0,
                    description: 'Zero-based index of the new image set to use as preview thumbnail',
                },
                images: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Product images (up to 8)',
                },
            },
        },
    }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('images', 8, multerOptions)),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_product_dto_1.UpdateProductDto, Array]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Post)('products/:id/submit'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MANAGE_OWN),
    (0, swagger_1.ApiOperation)({ summary: 'Submit product for admin review' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "submitProduct", null);
__decorate([
    (0, common_1.Post)('products/:id/withdraw'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MANAGE_OWN),
    (0, swagger_1.ApiOperation)({ summary: 'Withdraw a product from listing' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "withdrawProduct", null);
__decorate([
    (0, common_1.Delete)('products/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MANAGE_OWN),
    (0, swagger_1.ApiOperation)({ summary: 'Hard-delete own product (DRAFT or REJECTED only)' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "deleteProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id/images/order'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MANAGE_OWN),
    (0, swagger_1.ApiOperation)({
        summary: 'Reorder images for own product (DRAFT or REJECTED only). First ID becomes the preview.',
    }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reorder_images_dto_1.ReorderImagesDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "reorderImages", null);
__decorate([
    (0, common_1.Patch)('products/:id/preview-image'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MANAGE_OWN),
    (0, swagger_1.ApiOperation)({
        summary: 'Set the preview thumbnail image for own product (DRAFT or REJECTED only)',
    }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, set_preview_image_dto_1.SetPreviewImageDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "setPreviewImage", null);
__decorate([
    (0, common_1.Get)('admin/products'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_VIEW_ALL),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: list all products (all statuses)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [admin_list_products_query_dto_1.AdminListProductsQueryDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "listAllProducts", null);
__decorate([
    (0, common_1.Get)('admin/products/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_VIEW_ALL),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: get any product by ID' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "getAdminProduct", null);
__decorate([
    (0, common_1.Patch)('admin/products/:id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MODERATE),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: approve a submitted product' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "approveProduct", null);
__decorate([
    (0, common_1.Patch)('admin/products/:id/reject'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MODERATE),
    (0, swagger_1.ApiOperation)({ summary: 'Admin: reject a submitted product with reason' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reject_product_dto_1.RejectProductDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "rejectProduct", null);
__decorate([
    (0, common_1.Patch)('admin/products/:id/images/order'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MODERATE),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin: reorder images for any product. First ID becomes the preview.',
    }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, reorder_images_dto_1.ReorderImagesDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "adminReorderImages", null);
__decorate([
    (0, common_1.Patch)('admin/products/:id/preview-image'),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PRODUCT_MODERATE),
    (0, swagger_1.ApiOperation)({
        summary: 'Admin: set the preview thumbnail image for any product',
    }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, set_preview_image_dto_1.SetPreviewImageDto]),
    __metadata("design:returntype", Promise)
], ProductsController.prototype, "adminSetPreviewImage", null);
exports.ProductsController = ProductsController = __decorate([
    (0, swagger_1.ApiTags)('products'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map