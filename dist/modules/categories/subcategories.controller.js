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
exports.SubcategoriesController = void 0;
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
const create_subcategory_dto_1 = require("./dto/create-subcategory.dto");
const update_subcategory_dto_1 = require("./dto/update-subcategory.dto");
let SubcategoriesController = class SubcategoriesController {
    categoriesService;
    constructor(categoriesService) {
        this.categoriesService = categoriesService;
    }
    async listSubcategories(categoryId) {
        return this.categoriesService.listSubcategories({
            categoryId,
            includeInactive: false,
        });
    }
    async getSubcategoryById(id) {
        return this.categoriesService.getSubcategoryById(id);
    }
    async createSubcategory(dto, icon) {
        return this.categoriesService.createSubcategory(dto, icon);
    }
    async updateSubcategory(id, dto, icon) {
        return this.categoriesService.updateSubcategory(id, dto, icon);
    }
    async deleteSubcategory(id) {
        await this.categoriesService.deleteSubcategory(id);
        return { success: true };
    }
};
exports.SubcategoriesController = SubcategoriesController;
__decorate([
    (0, common_1.Get)(),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({
        summary: 'List active subcategories (public). Use ?categoryId=xxx for cascading dropdown.',
    }),
    (0, swagger_1.ApiQuery)({
        name: 'categoryId',
        required: false,
        description: 'Filter by parent category UUID',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Array of active subcategories, ordered by displayOrder then name. Pass ?categoryId to filter by parent.',
        schema: { type: 'array', items: api_responses_1.SubcategorySchema },
    }),
    __param(0, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubcategoriesController.prototype, "listSubcategories", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get subcategory by ID (Admin/SuperAdmin only)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Subcategory object.',
        schema: api_responses_1.SubcategorySchema,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubcategoriesController.prototype, "getSubcategoryById", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new subcategory (Admin/SuperAdmin only)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            required: ['categoryId', 'name'],
            properties: {
                categoryId: { type: 'string', format: 'uuid' },
                name: { type: 'string', example: 'Mobile Phones' },
                displayOrder: { type: 'number', example: 0 },
                icon: { type: 'string', format: 'binary' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Subcategory created.',
        schema: api_responses_1.SubcategorySchema,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R400),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Parent category not found or inactive.',
        ...api_responses_1.R404,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R409),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('icon', { storage: (0, multer_1.memoryStorage)() })),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ whitelist: true, transform: true })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_subcategory_dto_1.CreateSubcategoryDto, Object]),
    __metadata("design:returntype", Promise)
], SubcategoriesController.prototype, "createSubcategory", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update a subcategory (Admin/SuperAdmin only)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                categoryId: { type: 'string', format: 'uuid' },
                name: { type: 'string', example: 'Mobile Phones' },
                displayOrder: { type: 'number', example: 0 },
                isActive: { type: 'boolean', example: true },
                icon: { type: 'string', format: 'binary' },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Updated subcategory object.',
        schema: api_responses_1.SubcategorySchema,
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
    __metadata("design:paramtypes", [String, update_subcategory_dto_1.UpdateSubcategoryDto, Object]),
    __metadata("design:returntype", Promise)
], SubcategoriesController.prototype, "updateSubcategory", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete a subcategory (Admin/SuperAdmin only)',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Subcategory deactivated (isActive set to false).',
        ...api_responses_1.SuccessResponse,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubcategoriesController.prototype, "deleteSubcategory", null);
exports.SubcategoriesController = SubcategoriesController = __decorate([
    (0, swagger_1.ApiTags)('subcategories'),
    (0, common_1.Controller)('subcategories'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [categories_service_1.CategoriesService])
], SubcategoriesController);
//# sourceMappingURL=subcategories.controller.js.map