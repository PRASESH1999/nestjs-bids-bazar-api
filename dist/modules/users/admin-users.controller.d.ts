import { UsersService } from './users.service';
export declare class AdminUsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    resetNameChange(id: string): Promise<{
        success: boolean;
    }>;
}
