import { PaginationDto } from "../../common/dto/pagination.dto";
import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    createAdmin(createAdminDto: CreateAdminDto): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }>;
    getProfile(req: RequestWithUser): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    } | null>;
    updateProfile(req: RequestWithUser, updateData: UpdateUserDto): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }>;
    findAll(req: RequestWithUser, pagination: PaginationDto): Promise<{
        data: {
            name: string;
            email: string;
            role: import("../../common/enums/role.enum").Role;
            isActive: boolean;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date;
        }[];
        meta: {
            page: number | undefined;
            limit: number | undefined;
            total: number;
        };
    }>;
    suspendUser(id: string): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }>;
    deleteUser(id: string): Promise<{
        success: boolean;
    }>;
    assignRole(id: string, assignRoleDto: AssignRoleDto): Promise<{
        name: string;
        email: string;
        role: import("../../common/enums/role.enum").Role;
        isActive: boolean;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date;
    }>;
}
