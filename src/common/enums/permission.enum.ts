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
  CATEGORY_MANAGE = 'category:manage',

  // KYC permissions
  KYC_SUBMIT = 'kyc:submit',
  KYC_VIEW_OWN = 'kyc:view_own',
  KYC_VIEW_ALL = 'kyc:view_all',
  KYC_REVIEW = 'kyc:review',
  BANK_VIEW_DECRYPTED = 'bank:view_decrypted',

  // Product permissions
  PRODUCT_CREATE = 'product:create',
  PRODUCT_MANAGE_OWN = 'product:manage_own',
  PRODUCT_VIEW_OWN = 'product:view_own',
  PRODUCT_MODERATE = 'product:moderate',
  PRODUCT_VIEW_ALL = 'product:view_all',

  // Superadmin-only permissions
  ADMIN_VIEW = 'admin:view',
  ADMIN_MANAGE = 'admin:manage',
  ROLE_ASSIGN = 'role:assign',
  SYSTEM_CONFIG = 'system:config',
}
