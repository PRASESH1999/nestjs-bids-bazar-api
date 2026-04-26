import { Role } from '../../common/enums/role.enum';
import { Permission } from '../../common/enums/permission.enum';

export const RolePermissionsMap: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.ITEM_BUY,
    Permission.ITEM_SELL,
    Permission.ITEM_VIEW,
    Permission.ITEM_MANAGE_OWN,
    Permission.PROFILE_VIEW,
    Permission.PROFILE_EDIT,
  ],
  [Role.ADMIN]: [
    Permission.USER_VIEW,
    Permission.USER_MANAGE,
    Permission.CONTENT_MODERATE,
    Permission.ITEM_VIEW,
    Permission.PROFILE_VIEW,
  ],
  [Role.SUPERADMIN]: Object.values(Permission), // SUPERADMIN bypasses checks, but this explicitly maps all for completeness
};
