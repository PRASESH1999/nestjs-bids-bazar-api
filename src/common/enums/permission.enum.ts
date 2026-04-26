export enum Permission {
  // Item permissions (for USER role)
  ITEM_BUY = 'item:buy',
  ITEM_SELL = 'item:sell',
  ITEM_VIEW = 'item:view',
  ITEM_MANAGE_OWN = 'item:manage_own',

  // User self-service
  PROFILE_VIEW = 'profile:view',
  PROFILE_EDIT = 'profile:edit',

  // Admin permissions
  USER_VIEW = 'user:view',
  USER_MANAGE = 'user:manage',
  CONTENT_MODERATE = 'content:moderate',

  // Superadmin-only permissions
  ADMIN_VIEW = 'admin:view',
  ADMIN_MANAGE = 'admin:manage',
  ROLE_ASSIGN = 'role:assign',
  SYSTEM_CONFIG = 'system:config',
}
