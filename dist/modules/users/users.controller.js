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
exports.UsersController = void 0;
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const permission_enum_1 = require("../../common/enums/permission.enum");
const hierarchy_guard_1 = require("../../common/guards/hierarchy.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const assign_role_dto_1 = require("./dto/assign-role.dto");
const create_admin_dto_1 = require("./dto/create-admin.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const users_service_1 = require("./users.service");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async createAdmin(createAdminDto) {
        const user = await this.usersService.createAdmin(createAdminDto);
        const { password: _, hashedRefreshToken: __, ...result } = user;
        return result;
    }
    async getProfile(req) {
        const user = await this.usersService.findById(req.user.sub);
        if (!user)
            return null;
        const { password: _, hashedRefreshToken: __, ...result } = user;
        return result;
    }
    async updateProfile(req, updateData) {
        const user = await this.usersService.updateUser(req.user.sub, updateData);
        const { password: _, hashedRefreshToken: __, ...result } = user;
        return result;
    }
    async findAll(req, pagination) {
        const requesterRole = req.user.role;
        const [users, total] = await this.usersService.findAll(pagination, requesterRole);
        const data = users.map((user) => {
            const { password: _, hashedRefreshToken: __, ...result } = user;
            return result;
        });
        return {
            data,
            meta: {
                page: pagination.page,
                limit: pagination.limit,
                total,
            },
        };
    }
    async suspendUser(id) {
        const user = await this.usersService.suspendUser(id);
        const { password: _, hashedRefreshToken: __, ...result } = user;
        return result;
    }
    async deleteUser(id) {
        await this.usersService.deleteUser(id);
        return { success: true };
    }
    async assignRole(id, assignRoleDto) {
        const user = await this.usersService.updateUser(id, {
            role: assignRoleDto.role,
        });
        const { password: _, hashedRefreshToken: __, ...result } = user;
        return result;
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Post)('admin'),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a new Admin or SuperAdmin (SuperAdmin only)',
    }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.ROLE_ASSIGN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_admin_dto_1.CreateAdminDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "createAdmin", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PROFILE_VIEW),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Update current user profile' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.PROFILE_EDIT),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all users (Admin/SuperAdmin only)' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.USER_VIEW),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)(':id/suspend'),
    (0, swagger_1.ApiOperation)({ summary: 'Suspend a user account' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.USER_MANAGE),
    (0, common_1.UseGuards)(hierarchy_guard_1.HierarchyGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "suspendUser", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete a user account' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.USER_MANAGE),
    (0, common_1.UseGuards)(hierarchy_guard_1.HierarchyGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "deleteUser", null);
__decorate([
    (0, common_1.Post)(':id/role'),
    (0, swagger_1.ApiOperation)({ summary: 'Assign a new role to a user' }),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.ROLE_ASSIGN),
    (0, common_1.UseGuards)(hierarchy_guard_1.HierarchyGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, assign_role_dto_1.AssignRoleDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "assignRole", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map