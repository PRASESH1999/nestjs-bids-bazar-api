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
exports.CategoriesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const api_responses_1 = require("../../common/swagger/api-responses");
const multer_1 = require("multer");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const permission_enum_1 = require("../../common/enums/permission.enum");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const categories_service_1 = require("./categories.service");
const create_category_dto_1 = require("./dto/create-category.dto");
const update_category_dto_1 = require("./dto/update-category.dto");
let CategoriesController = class CategoriesController {
    categoriesService;
    constructor(categoriesService) {
        this.categoriesService = categoriesService;
    }
    async listCategories() {
        return this.categoriesService.listCategories(false);
    }
    async getCategoryById(id) {
        return this.categoriesService.getCategoryById(id);
    }
    async createCategory(dto, icon) {
        return this.categoriesService.createCategory(dto, icon);
    }
    async updateCategory(id, dto, icon) {
        return this.categoriesService.updateCategory(id, dto, icon);
    }
    async deleteCategory(id) {
        await this.categoriesService.deleteCategory(id);
        return { success: true };
    }
};
exports.CategoriesController = CategoriesController;
__decorate([
    (0, common_1.Get)(),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all active categories (public)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Array of active categories, ordered by displayOrder then name.',
        schema: { type: 'array', items: api_responses_1.CategorySchema },
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CategoriesController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get category by ID (Admin/SuperAdmin only)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Category object.',
        schema: api_responses_1.CategorySchema,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CategoriesController.prototype, "getCategoryById", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new category (Admin/SuperAdmin only)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', example: 'Electronics' },
                displayOrder: { type: 'number', example: 0 },
                icon: { type: 'string', format: 'binary' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Category created.',
        schema: api_responses_1.CategorySchema,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R400),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R409),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('icon', { storage: (0, multer_1.memoryStorage)() })),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_category_dto_1.CreateCategoryDto, Object]),
    __metadata("design:returntype", Promise)
], CategoriesController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update a category (Admin/SuperAdmin only)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'Electronics' },
                displayOrder: { type: 'number', example: 0 },
                isActive: { type: 'boolean', example: true },
                icon: { type: 'string', format: 'binary' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Updated category object.',
        schema: api_responses_1.CategorySchema,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R400),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, swagger_1.ApiResponse)(api_responses_1.R409),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('icon', { storage: (0, multer_1.memoryStorage)() })),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_category_dto_1.UpdateCategoryDto, Object]),
    __metadata("design:returntype", Promise)
], CategoriesController.prototype, "updateCategory", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete a category (Admin/SuperAdmin only)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Category deactivated (isActive set to false). Hard delete is not performed.',
        ...api_responses_1.SuccessResponse,
    }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: 'Cannot deactivate — category has active subcategories. Deactivate subcategories first.',
        ...api_responses_1.R409,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CategoriesController.prototype, "deleteCategory", null);
exports.CategoriesController = CategoriesController = __decorate([
    (0, swagger_1.ApiTags)('categories'),
    (0, common_1.Controller)('categories'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [categories_service_1.CategoriesService])
], CategoriesController);
//# sourceMappingURL=categories.controller.js.map