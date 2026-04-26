import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";
import { Role } from "../../common/enums/role.enum";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { CreateAdminDto } from './dto/create-admin.dto';
export declare class UsersService {
    private readonly usersRepository;
    constructor(usersRepository: UsersRepository);
    findAll(pagination: PaginationDto, requesterRole: Role): Promise<[User[], number]>;
    create(data: Partial<User>): Promise<User>;
    createAdmin(data: CreateAdminDto): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    updateUser(id: string, data: Partial<User>): Promise<User>;
    suspendUser(id: string): Promise<User>;
    deleteUser(id: string): Promise<void>;
    updateRefreshToken(id: string, refreshToken: string | null): Promise<void>;
}
