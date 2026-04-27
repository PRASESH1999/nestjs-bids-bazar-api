"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolePermissionsMap = void 0;
const role_enum_1 = require("../../common/enums/role.enum");
const permission_enum_1 = require("../../common/enums/permission.enum");
exports.RolePermissionsMap = {
    [role_enum_1.Role.USER]: [
        permission_enum_1.Permission.ITEM_BUY,
        permission_enum_1.Permission.ITEM_SELL,
        permission_enum_1.Permission.ITEM_VIEW,
        permission_enum_1.Permission.ITEM_MANAGE_OWN,
        permission_enum_1.Permission.PROFILE_VIEW,
        permission_enum_1.Permission.PROFILE_EDIT,
        permission_enum_1.Permission.KYC_SUBMIT,
        permission_enum_1.Permission.KYC_VIEW_OWN,
    ],
    [role_enum_1.Role.ADMIN]: [
        permission_enum_1.Permission.USER_VIEW,
        permission_enum_1.Permission.USER_MANAGE,
        permission_enum_1.Permission.CONTENT_MODERATE,
        permission_enum_1.Permission.ITEM_VIEW,
        permission_enum_1.Permission.PROFILE_VIEW,
        permission_enum_1.Permission.KYC_VIEW_ALL,
        permission_enum_1.Permission.KYC_REVIEW,
    ],
    [role_enum_1.Role.SUPERADMIN]: Object.values(permission_enum_1.Permission),
};
//# sourceMappingURL=role-permissions.map.js.map