"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const role_enum_1 = require("../../common/enums/role.enum");
const pending_email_change_entity_1 = require("../auth/entities/pending-email-change.entity");
const pending_email_change_repository_1 = require("../auth/pending-email-change.repository");
const kyc_verification_entity_1 = require("../kyc/entities/kyc-verification.entity");
const mail_service_1 = require("../mail/mail.service");
const users_repository_1 = require("./users.repository");
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const typeorm_1 = require("typeorm");
const username_validator_1 = require("./username.validator");
let UsersService = UsersService_1 = class UsersService {
    usersRepository;
    dataSource;
    mailService;
    pendingEmailChangeRepository;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(usersRepository, dataSource, mailService, pendingEmailChangeRepository) {
        this.usersRepository = usersRepository;
        this.dataSource = dataSource;
        this.mailService = mailService;
        this.pendingEmailChangeRepository = pendingEmailChangeRepository;
    }
    async findAll(pagination, requesterRole) {
        const { page = 1, limit = 20 } = pagination;
        let rolesToInclude;
        if (requesterRole === role_enum_1.Role.ADMIN) {
            rolesToInclude = [role_enum_1.Role.USER];
        }
        else if (requesterRole === role_enum_1.Role.SUPERADMIN) {
            rolesToInclude = [role_enum_1.Role.SUPERADMIN, role_enum_1.Role.ADMIN, role_enum_1.Role.USER];
        }
        else {
            rolesToInclude = [];
        }
        return this.usersRepository.findAllPaginated(page, limit, rolesToInclude);
    }
    async create(data) {
        const user = this.usersRepository.createEntity(data);
        return this.usersRepository.saveUser(user);
    }
    async createAdmin(data) {
        const { password, email, username, ...rest } = data;
        const normalizedEmail = email.toLowerCase();
        const normalizedUsername = username.trim();
        const existing = await this.usersRepository.findByEmail(normalizedEmail);
        if (existing) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        const usernameTaken = await this.usersRepository.findByUsernameIncludingDeleted(normalizedUsername);
        if (usernameTaken) {
            throw new common_1.ConflictException({
                statusCode: 409,
                code: 'USERNAME_TAKEN',
                message: 'This username is already taken.',
            });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = this.usersRepository.createEntity({
            ...rest,
            email: normalizedEmail,
            username: normalizedUsername,
            password: hashedPassword,
            isActive: true,
        });
        return this.usersRepository.saveUser(user);
    }
    async findByEmail(email) {
        return this.usersRepository.findByEmail(email);
    }
    async findByEmailIncludingDeleted(email) {
        return this.usersRepository.findByEmailIncludingDeleted(email);
    }
    async findById(id) {
        return this.usersRepository.findById(id);
    }
    async findByUsername(username, excludeUserId) {
        return this.usersRepository.findByUsername(username, excludeUserId);
    }
    async findByUsernameIncludingDeleted(username) {
        return this.usersRepository.findByUsernameIncludingDeleted(username);
    }
    async updateUser(id, data) {
        const user = await this.findById(id);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (data.role !== undefined &&
            user.role === role_enum_1.Role.SUPERADMIN &&
            data.role !== role_enum_1.Role.SUPERADMIN) {
            throw new common_1.ForbiddenException('SUPERADMIN role cannot be downgraded');
        }
        if (data.email) {
            data.email = data.email.toLowerCase();
        }
        Object.assign(user, data);
        return this.usersRepository.saveUser(user);
    }
    async suspendUser(id) {
        const user = await this.findById(id);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        user.isActive = false;
        user.hashedRefreshToken = null;
        return this.usersRepository.saveUser(user);
    }
    async deleteUser(id) {
        const user = await this.findById(id);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        await this.usersRepository.softDeleteUser(user);
    }
    async updateRefreshToken(id, refreshToken) {
        if (refreshToken) {
            const hashedToken = await bcrypt.hash(refreshToken, 12);
            await this.usersRepository.updateUser(id, {
                hashedRefreshToken: hashedToken,
            });
        }
        else {
            await this.usersRepository.updateUser(id, { hashedRefreshToken: null });
        }
    }
    async updateUserInTransaction(id, data, queryRunner) {
        await this.usersRepository.updateUser(id, data, queryRunner);
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        if (currentPassword === newPassword) {
            throw new common_1.BadRequestException('New password must be different from current password');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.usersRepository.updateUser(userId, { password: hashedPassword, hashedRefreshToken: null }, queryRunner);
            await queryRunner.commitTransaction();
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
        try {
            await this.mailService.sendPasswordChangedConfirmation(user.email, user.name);
        }
        catch (err) {
            this.logger.error('[changePassword] Failed to dispatch confirmation email', err instanceof Error ? err.stack : String(err));
        }
    }
    async getOwnProfile(userId) {
        const user = await this.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const kycRepo = this.dataSource.getRepository(kyc_verification_entity_1.KycVerification);
        const kyc = await kycRepo.findOne({ where: { userId } });
        const pending = await this.dataSource
            .getRepository(pending_email_change_entity_1.PendingEmailChange)
            .findOne({ where: { userId } });
        const kycSummary = kyc
            ? {
                status: kyc.status,
                submittedAt: kyc.createdAt,
                reviewedAt: kyc.reviewedAt,
                rejectionReason: kyc.rejectionReason,
            }
            : null;
        const pendingEmailChangeSummary = pending
            ? { newEmail: pending.newEmail, expiresAt: pending.expiresAt }
            : null;
        return {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
            nameChangedAt: user.nameChangedAt,
            usernameChangedAt: user.usernameChangedAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            kyc: kycSummary,
            pendingEmailChange: pendingEmailChangeSummary,
        };
    }
    async updateSelfName(userId, newName) {
        const user = await this.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (user.nameChangedAt !== null) {
            throw new common_1.ForbiddenException('Display name can only be changed once. Please contact support.');
        }
        if (newName.trim() === user.name.trim()) {
            throw new common_1.BadRequestException('New display name must be different from your current name.');
        }
        const now = new Date();
        await this.usersRepository.updateUser(userId, {
            name: newName,
            nameChangedAt: now,
        });
        try {
            await this.mailService.sendNameChangedConfirmation(user.email, newName);
        }
        catch (err) {
            this.logger.error('[updateSelfName] Failed to dispatch name-changed email', err instanceof Error ? err.stack : String(err));
        }
    }
    async checkUsernameAvailability(username) {
        const formatError = (0, username_validator_1.validateUsernameFormat)(username);
        if (formatError) {
            return { available: false, reason: formatError };
        }
        const existing = await this.usersRepository.findByUsername(username);
        if (existing) {
            return { available: false, reason: 'TAKEN' };
        }
        return { available: true };
    }
    async updateSelfUsername(userId, newUsername) {
        const user = await this.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (newUsername.trim().toLowerCase() === user.username.trim().toLowerCase()) {
            throw new common_1.BadRequestException('New username must be different from your current username.');
        }
        if (user.usernameChangedAt !== null) {
            throw new common_1.ForbiddenException('Username can only be changed once. Please contact support.');
        }
        const normalizedUsername = newUsername.trim();
        const taken = await this.usersRepository.findByUsername(normalizedUsername, userId);
        if (taken) {
            throw new common_1.ConflictException('USERNAME_TAKEN');
        }
        const now = new Date();
        await this.usersRepository.updateUser(userId, {
            username: normalizedUsername,
            usernameChangedAt: now,
        });
        try {
            await this.mailService.sendUsernameChangedConfirmation(user.email, normalizedUsername);
        }
        catch (err) {
            this.logger.error('[updateSelfUsername] Failed to dispatch username-changed email', err instanceof Error ? err.stack : String(err));
        }
    }
    async requestEmailChange(userId, newEmail, currentPassword) {
        const normalizedNew = newEmail.toLowerCase();
        const user = await this.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        if (normalizedNew === user.email.toLowerCase()) {
            throw new common_1.BadRequestException('New email must be different from your current email');
        }
        const taken = await this.usersRepository.findByEmail(normalizedNew);
        if (taken) {
            throw new common_1.ConflictException('Email address is already in use');
        }
        await this.pendingEmailChangeRepository.deleteByUserId(userId);
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');
        const expiresAt = new Date(Date.now() + 3_600_000);
        await this.pendingEmailChangeRepository.saveRecord(userId, normalizedNew, tokenHash, expiresAt);
        try {
            await this.mailService.sendEmailChangeVerification(normalizedNew, user.name, rawToken);
        }
        catch (err) {
            this.logger.error('[requestEmailChange] Failed to dispatch verification email', err instanceof Error ? err.stack : String(err));
        }
    }
    async resetNameChangeQuota(targetUserId) {
        const user = await this.findById(targetUserId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.usersRepository.updateUser(targetUserId, {
            nameChangedAt: null,
        });
    }
    async resetUsernameChangeQuota(targetUserId) {
        const user = await this.findById(targetUserId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.usersRepository.updateUser(targetUserId, {
            usernameChangedAt: null,
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_repository_1.UsersRepository,
        typeorm_1.DataSource,
        mail_service_1.MailService,
        pending_email_change_repository_1.PendingEmailChangeRepository])
], UsersService);
//# sourceMappingURL=users.service.js.map