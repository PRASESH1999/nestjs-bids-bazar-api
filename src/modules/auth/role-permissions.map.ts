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
    Permission.KYC_SUBMIT,
    Permission.KYC_VIEW_OWN,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_MANAGE_OWN,
    Permission.PRODUCT_VIEW_OWN,
  ],
  [Role.ADMIN]: [
    Permission.USER_VIEW,
    Permission.USER_MANAGE,
    Permission.CONTENT_MODERATE,
    Permission.CATEGORY_MANAGE,
    Permission.ITEM_VIEW,
    Permission.PROFILE_VIEW,
    Permission.KYC_VIEW_ALL,
    Permission.KYC_REVIEW,
    Permission.PRODUCT_MODERATE,
    Permission.PRODUCT_VIEW_ALL,
  ],
  [Role.SUPERADMIN]: Object.values(Permission), // SUPERADMIN bypasses checks, but this explicitly maps all for completeness
};
