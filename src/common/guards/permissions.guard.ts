import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../enums/permission.enum';
import { Role } from '../enums/role.enum';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('No user attached to request');
    }

    // SUPERADMIN bypasses all permission checks
    if (user.role === Role.SUPERADMIN) {
      return true;
    }

    const hasPermission = () =>
      requiredPermissions.some((permission) =>
        user.permissions?.includes(permission),
      );

    if (!hasPermission()) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
