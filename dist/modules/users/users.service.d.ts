import { DataSource } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";
import { Role } from "../../common/enums/role.enum";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { CreateAdminDto } from './dto/create-admin.dto';
import { MailService } from "../mail/mail.service";
export declare class UsersService {
    private readonly usersRepository;
    private readonly dataSource;
    private readonly mailService;
    private readonly logger;
    constructor(usersRepository: UsersRepository, dataSource: DataSource, mailService: MailService);
    findAll(pagination: PaginationDto, requesterRole: Role): Promise<[User[], number]>;
    create(data: Partial<User>): Promise<User>;
    createAdmin(data: CreateAdminDto): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    updateUser(id: string, data: Partial<User>): Promise<User>;
    suspendUser(id: string): Promise<User>;
    deleteUser(id: string): Promise<void>;
    updateRefreshToken(id: string, refreshToken: string | null): Promise<void>;
    updateUserInTransaction(id: string, data: Partial<User>, queryRunner: QueryRunner): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
}
