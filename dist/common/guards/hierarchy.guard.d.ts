import { CanActivate, ExecutionContext } from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service';
export declare class HierarchyGuard implements CanActivate {
    private readonly usersService;
    constructor(usersService: UsersService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
