import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../enums/role.enum';
import { UsersService } from '../../modules/users/users.service';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';

@Injectable()
export class HierarchyGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const currentUser = request.user;

    if (!currentUser) {
      throw new ForbiddenException('No user attached to request');
    }

    if (currentUser.role === Role.SUPERADMIN) {
      return true;
    }

    const rawBody = request.body as Record<string, unknown>;
    const bodyUserId =
      typeof rawBody.userId === 'string' ? rawBody.userId : undefined;
    const rawParamId = request.params.id;
    const paramId = Array.isArray(rawParamId) ? rawParamId[0] : rawParamId;
    const targetUserId = paramId || bodyUserId;
    if (!targetUserId) {
      throw new ForbiddenException('Target user ID not provided');
    }

    if (currentUser.sub === targetUserId) {
      return true;
    }

    const targetUser = await this.usersService.findById(targetUserId);
    if (!targetUser) {
      return true;
    }

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

    if (currentUser.role === Role.USER) {
      throw new ForbiddenException('You do not have administrative privileges');
    }

    return true;
  }
}
