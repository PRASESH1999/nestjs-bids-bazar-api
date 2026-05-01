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
exports.AdminCategoriesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_responses_1 = require("../../common/swagger/api-responses");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const permission_enum_1 = require("../../common/enums/permission.enum");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const categories_service_1 = require("./categories.service");
let AdminCategoriesController = class AdminCategoriesController {
    categoriesService;
    constructor(categoriesService) {
        this.categoriesService = categoriesService;
    }
    async listAllCategories(includeInactive) {
        return this.categoriesService.listCategories(includeInactive === 'true');
    }
    async listAllSubcategories(categoryId, includeInactive) {
        return this.categoriesService.listSubcategories({
            categoryId,
            includeInactive: includeInactive === 'true',
        });
    }
};
exports.AdminCategoriesController = AdminCategoriesController;
__decorate([
    (0, common_1.Get)('categories'),
    (0, swagger_1.ApiOperation)({
        summary: 'List all categories including inactive (Admin/SuperAdmin only). Use ?includeInactive=true.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'includeInactive', required: false, type: Boolean }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'All categories (active + inactive when includeInactive=true).',
        schema: { type: 'array', items: api_responses_1.CategorySchema },
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    __param(0, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminCategoriesController.prototype, "listAllCategories", null);
__decorate([
    (0, common_1.Get)('subcategories'),
    (0, swagger_1.ApiOperation)({
        summary: 'List all subcategories including inactive (Admin/SuperAdmin only).',
    }),
    (0, swagger_1.ApiQuery)({ name: 'categoryId', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'includeInactive', required: false, type: Boolean }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'All subcategories (active + inactive when includeInactive=true). Filter by categoryId to get subcategories for a specific parent.',
        schema: { type: 'array', items: api_responses_1.SubcategorySchema },
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.CATEGORY_MANAGE),
    __param(0, (0, common_1.Query)('categoryId')),
    __param(1, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminCategoriesController.prototype, "listAllSubcategories", null);
exports.AdminCategoriesController = AdminCategoriesController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [categories_service_1.CategoriesService])
], AdminCategoriesController);
//# sourceMappingURL=admin-categories.controller.js.map