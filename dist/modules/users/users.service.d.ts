import { PaginationDto } from "../../common/dto/pagination.dto";
import { Role } from "../../common/enums/role.enum";
import { PendingEmailChangeRepository } from "../auth/pending-email-change.repository";
import { MailService } from "../mail/mail.service";
import { User } from "./entities/user.entity";
import { UsersRepository } from "./users.repository";
import type { QueryRunner } from 'typeorm';
import { DataSource } from 'typeorm';
import { CreateAdminDto } from './dto/create-admin.dto';
import type { OwnProfileResponse } from './interfaces/own-profile.interface';
import { UsernameValidationError } from './username.validator';
export interface UsernameAvailabilityResult {
    available: boolean;
    reason?: UsernameValidationError | 'TAKEN';
}
export declare class UsersService {
    private readonly usersRepository;
    private readonly dataSource;
    private readonly mailService;
    private readonly pendingEmailChangeRepository;
    private readonly logger;
    constructor(usersRepository: UsersRepository, dataSource: DataSource, mailService: MailService, pendingEmailChangeRepository: PendingEmailChangeRepository);
    findAll(pagination: PaginationDto, requesterRole: Role): Promise<[User[], number]>;
    create(data: Partial<User>): Promise<User>;
    createAdmin(data: CreateAdminDto): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    findByEmailIncludingDeleted(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findByUsername(username: string, excludeUserId?: string): Promise<User | null>;
    findByUsernameIncludingDeleted(username: string): Promise<User | null>;
    updateUser(id: string, data: Partial<User>): Promise<User>;
    suspendUser(id: string): Promise<User>;
    deleteUser(id: string): Promise<void>;
    updateRefreshToken(id: string, refreshToken: string | null): Promise<void>;
    updateUserInTransaction(id: string, data: Partial<User>, queryRunner: QueryRunner): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    getOwnProfile(userId: string): Promise<OwnProfileResponse>;
    updateSelfName(userId: string, newName: string): Promise<void>;
    checkUsernameAvailability(username: string): Promise<UsernameAvailabilityResult>;
    updateSelfUsername(userId: string, newUsername: string): Promise<void>;
    requestEmailChange(userId: string, newEmail: string, currentPassword: string): Promise<void>;
    resetNameChangeQuota(targetUserId: string): Promise<void>;
    resetUsernameChangeQuota(targetUserId: string): Promise<void>;
}
