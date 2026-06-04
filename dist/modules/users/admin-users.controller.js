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
exports.AdminUsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const api_responses_1 = require("../../common/swagger/api-responses");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const permission_enum_1 = require("../../common/enums/permission.enum");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const users_service_1 = require("./users.service");
let AdminUsersController = class AdminUsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async resetNameChange(id) {
        await this.usersService.resetNameChangeQuota(id);
        return { success: true };
    }
    async resetUsernameChange(id) {
        await this.usersService.resetUsernameChangeQuota(id);
        return { success: true };
    }
};
exports.AdminUsersController = AdminUsersController;
__decorate([
    (0, common_1.Post)('users/:id/reset-name-change'),
    (0, swagger_1.ApiOperation)({
        summary: "Reset a user's one-time name-change quota (SuperAdmin only)",
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Name-change quota reset. The user can change their name once more.',
        ...api_responses_1.SuccessResponse,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.NAME_CHANGE_RESET),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "resetNameChange", null);
__decorate([
    (0, common_1.Post)('users/:id/reset-username-change'),
    (0, swagger_1.ApiOperation)({
        summary: "Reset a user's one-time username-change quota (SuperAdmin only)",
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Username-change quota reset. The user can change their username once more.',
        ...api_responses_1.SuccessResponse,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, swagger_1.ApiResponse)(api_responses_1.R403),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, require_permissions_decorator_1.RequirePermissions)(permission_enum_1.Permission.USERNAME_CHANGE_RESET),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminUsersController.prototype, "resetUsernameChange", null);
exports.AdminUsersController = AdminUsersController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], AdminUsersController);
//# sourceMappingURL=admin-users.controller.js.map