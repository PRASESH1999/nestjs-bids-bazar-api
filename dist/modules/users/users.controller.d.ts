import { PaginationDto } from "../../common/dto/pagination.dto";
import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import { AssignRoleDto } from './dto/assign-role.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    createAdmin(createAdminDto: CreateAdminDto): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        isEmailVerified: boolean;
        nameChangedAt: Date | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    getProfile(req: RequestWithUser): Promise<import("./interfaces/own-profile.interface").OwnProfileResponse>;
    updateProfile(req: RequestWithUser, dto: UpdateSelfDto): Promise<{
        message: string;
    }>;
    requestEmailChange(req: RequestWithUser, dto: ChangeEmailDto): Promise<{
        message: string;
    }>;
    changePassword(req: RequestWithUser, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    findAll(req: RequestWithUser, pagination: PaginationDto): Promise<{
        data: {
            name: string;
            email: string;
            role: import("../../common/enums/role.enum").Role;
            isActive: boolean;
            isEmailVerified: boolean;
            nameChangedAt: Date | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    suspendUser(id: string): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        isEmailVerified: boolean;
        nameChangedAt: Date | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    deleteUser(id: string): Promise<{
        success: boolean;
    }>;
    assignRole(id: string, assignRoleDto: AssignRoleDto): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        isEmailVerified: boolean;
        nameChangedAt: Date | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
}
