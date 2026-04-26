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
exports.HierarchyGuard = void 0;
const common_1 = require("@nestjs/common");
const role_enum_1 = require("../enums/role.enum");
const users_service_1 = require("../../modules/users/users.service");
let HierarchyGuard = class HierarchyGuard {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const currentUser = request.user;
        if (!currentUser) {
            throw new common_1.ForbiddenException('No user attached to request');
        }
        if (currentUser.role === role_enum_1.Role.SUPERADMIN) {
            return true;
        }
        const targetUserId = request.params.id || request.body.userId;
        if (!targetUserId) {
            throw new common_1.ForbiddenException('Target user ID not provided');
        }
        if (currentUser.id === targetUserId) {
            return true;
        }
        const targetUser = await this.usersService.findById(targetUserId);
        if (!targetUser) {
            return true;
        }
        if (currentUser.role === role_enum_1.Role.ADMIN) {
            if (targetUser.role === role_enum_1.Role.ADMIN ||
                targetUser.role === role_enum_1.Role.SUPERADMIN) {
                throw new common_1.ForbiddenException('You cannot manage this user due to role hierarchy');
            }
        }
        if (currentUser.role === role_enum_1.Role.USER) {
            throw new common_1.ForbiddenException('You do not have administrative privileges');
        }
        return true;
    }
};
exports.HierarchyGuard = HierarchyGuard;
exports.HierarchyGuard = HierarchyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], HierarchyGuard);
//# sourceMappingURL=hierarchy.guard.js.map