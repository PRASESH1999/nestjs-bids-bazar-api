import { Permission } from '../enums/permission.enum';
export declare const PERMISSIONS_KEY = "permissions";
export declare const RequirePermissions: (...permissions: Permission[]) => import("@nestjs/common").CustomDecorator<string>;
