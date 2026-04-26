import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class HierarchyGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUser = request.user;

    if (!currentUser) {
      throw new ForbiddenException('No user attached to request');
    }

    // SUPERADMIN can manage everyone
    if (currentUser.role === Role.SUPERADMIN) {
      return true;
    }

    const targetUserId = request.params.id || request.body.userId;
    if (!targetUserId) {
      throw new ForbiddenException('Target user ID not provided');
    }

    // Prevent self-management for certain admin actions if needed, though often handled by ownership logic.
    if (currentUser.id === targetUserId) {
      return true; // Users can typically manage themselves (e.g. edit profile) unless specifically restricted.
    }

    const targetUser = await this.usersService.findById(targetUserId);
    if (!targetUser) {
      return true; // Let the actual controller handle the 404
    }

    // ADMIN can only manage USER accounts
    if (currentUser.role === Role.ADMIN) {
      if (
        targetUser.role === Role.ADMIN ||
        targetUser.role === Role.SUPERADMIN
      ) {
        throw new ForbiddenException(
          'You cannot manage this user due to role hierarchy',
        );
      }
    }

    // USERs typically shouldn't be here if @RequirePermissions is properly set,
    // but we add this just in case they reach this guard.
    if (currentUser.role === Role.USER) {
      throw new ForbiddenException('You do not have administrative privileges');
    }

    return true;
  }
}
