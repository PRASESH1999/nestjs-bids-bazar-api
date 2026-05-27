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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const role_enum_1 = require("../../common/enums/role.enum");
const mail_service_1 = require("../mail/mail.service");
const users_service_1 = require("../users/users.service");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const typeorm_1 = require("typeorm");
const auth_repository_1 = require("./auth.repository");
const password_reset_repository_1 = require("./password-reset.repository");
const pending_email_change_repository_1 = require("./pending-email-change.repository");
const role_permissions_map_1 = require("./role-permissions.map");
let AuthService = AuthService_1 = class AuthService {
    usersService;
    jwtService;
    configService;
    mailService;
    authRepository;
    passwordResetRepository;
    pendingEmailChangeRepository;
    dataSource;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(usersService, jwtService, configService, mailService, authRepository, passwordResetRepository, pendingEmailChangeRepository, dataSource) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.mailService = mailService;
        this.authRepository = authRepository;
        this.passwordResetRepository = passwordResetRepository;
        this.pendingEmailChangeRepository = pendingEmailChangeRepository;
        this.dataSource = dataSource;
    }
    async validateUser(email, pass) {
        const user = await this.usersService.findByEmailIncludingDeleted(email);
        if (!user)
            return null;
        if (user.deletedAt !== null) {
            throw new common_1.ForbiddenException('This account has been deleted. Please contact support for account recovery.');
        }
        if (!user.isActive) {
            throw new common_1.ForbiddenException({
                statusCode: 403,
                code: 'ACCOUNT_SUSPENDED',
                message: 'Your account has been suspended. Please contact support.',
            });
        }
        if (!(await bcrypt.compare(pass, user.password)))
            return null;
        const { password: _, hashedRefreshToken: __, ...result } = user;
        return result;
    }
    async login(user) {
        if (!user.isEmailVerified) {
            throw new common_1.ForbiddenException({
                statusCode: 403,
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before logging in. Check your inbox or request a new verification email.',
            });
        }
        const permissions = role_permissions_map_1.RolePermissionsMap[user.role] || [];
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions,
        };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = crypto.randomBytes(64).toString('hex');
        await this.usersService.updateRefreshToken(user.id, refreshToken);
        return {
            accessToken,
            refreshToken,
        };
    }
    async register(data) {
        const email = data.email.toLowerCase();
        const existingUser = await this.usersService.findByEmailIncludingDeleted(email);
        if (existingUser) {
            if (existingUser.deletedAt !== null) {
                throw new common_1.ForbiddenException('This account has been deleted. Please contact support for account recovery.');
            }
            throw new common_1.ConflictException('User with this email already exists');
        }
        const { password, ...rest } = data;
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await this.usersService.create({
            ...rest,
            email,
            password: hashedPassword,
            role: role_enum_1.Role.USER,
        });
        await this.sendVerificationEmail(user.id, user.email);
        return {
            message: 'Account created. Please check your email to verify your account before logging in.',
        };
    }
    async sendVerificationEmail(userId, email) {
        await this.authRepository.deleteTokensByUserId(userId);
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await this.authRepository.saveToken(userId, tokenHash, expiresAt);
        await this.mailService.sendVerificationEmail(email, rawToken);
    }
    async verifyEmail(rawToken) {
        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');
        const tokenRecord = await this.authRepository.findByTokenHash(tokenHash);
        if (!tokenRecord) {
            throw new common_1.NotFoundException('Invalid verification link');
        }
        if (tokenRecord.expiresAt < new Date()) {
            throw new common_1.GoneException('Verification link has expired. Please request a new one.');
        }
        await this.usersService.updateUser(tokenRecord.userId, {
            isEmailVerified: true,
        });
        await this.authRepository.deleteById(tokenRecord.id);
    }
    async resendVerification(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user)
            return;
        if (user.isEmailVerified) {
            throw new common_1.BadRequestException('Email already verified');
        }
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        const count = await this.authRepository.countTokensSince(user.id, oneHourAgo);
        if (count >= 3) {
            throw new common_1.ForbiddenException('Too many resend attempts. Try again later.');
        }
        await this.sendVerificationEmail(user.id, user.email);
    }
    async refresh(refreshToken, userId) {
        const user = await this.usersService.findById(userId);
        if (!user || !user.isActive || !user.hashedRefreshToken) {
            throw new common_1.UnauthorizedException('Access Denied');
        }
        const refreshTokenMatches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
        if (!refreshTokenMatches) {
            await this.usersService.updateRefreshToken(user.id, null);
            throw new common_1.UnauthorizedException('Refresh token reused or invalid');
        }
        const permissions = role_permissions_map_1.RolePermissionsMap[user.role] || [];
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions,
        };
        const newAccessToken = this.jwtService.sign(payload);
        const newRefreshToken = crypto.randomBytes(64).toString('hex');
        await this.usersService.updateRefreshToken(user.id, newRefreshToken);
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }
    async logout(userId) {
        await this.usersService.updateRefreshToken(userId, null);
    }
    async requestPasswordReset(email) {
        const normalizedEmail = email.toLowerCase();
        const user = await this.usersService.findByEmail(normalizedEmail);
        if (!user || !user.isActive)
            return;
        const oneHourAgo = new Date(Date.now() - 3_600_000);
        const count = await this.passwordResetRepository.countRequestsSince(user.id, oneHourAgo);
        if (count >= 3)
            return;
        await this.passwordResetRepository.softDeleteByUserId(user.id);
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');
        const expiresAt = new Date(Date.now() + 3_600_000);
        await this.passwordResetRepository.saveToken(user.id, tokenHash, expiresAt);
        try {
            await this.mailService.sendPasswordResetEmail(user.email, rawToken, user.name);
        }
        catch (err) {
            this.logger.error('[requestPasswordReset] Failed to dispatch reset email', err instanceof Error ? err.stack : String(err));
        }
    }
    async resetPassword(rawToken, newPassword) {
        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');
        const tokenRecord = await this.passwordResetRepository.findByTokenHash(tokenHash);
        if (!tokenRecord) {
            throw new common_1.NotFoundException('Invalid or expired link');
        }
        if (tokenRecord.expiresAt < new Date()) {
            await this.passwordResetRepository.deleteById(tokenRecord.id);
            throw new common_1.NotFoundException('Invalid or expired link');
        }
        const user = await this.usersService.findById(tokenRecord.userId);
        if (!user || !user.isActive) {
            throw new common_1.NotFoundException('Invalid or expired link');
        }
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const updates = {
            password: hashedPassword,
            hashedRefreshToken: null,
        };
        if (!user.isEmailVerified) {
            updates.isEmailVerified = true;
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.usersService.updateUserInTransaction(user.id, updates, queryRunner);
            await this.passwordResetRepository.deleteById(tokenRecord.id, queryRunner);
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
            this.logger.error('[resetPassword] Failed to dispatch confirmation email', err instanceof Error ? err.stack : String(err));
        }
    }
    async cleanupExpiredResetTokens() {
        const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000);
        const deleted = await this.passwordResetRepository.deleteExpiredBefore(cutoff);
        return { deleted };
    }
    async verifyEmailChange(rawToken) {
        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');
        const pending = await this.pendingEmailChangeRepository.findByTokenHash(tokenHash);
        if (!pending) {
            throw new common_1.NotFoundException('Invalid or expired link');
        }
        if (pending.expiresAt < new Date()) {
            await this.pendingEmailChangeRepository.deleteById(pending.id);
            throw new common_1.NotFoundException('Invalid or expired link');
        }
        const user = await this.usersService.findById(pending.userId);
        if (!user || !user.isActive) {
            throw new common_1.NotFoundException('Invalid or expired link');
        }
        const oldEmail = user.email;
        const newEmail = pending.newEmail;
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await this.usersService.updateUserInTransaction(user.id, { email: newEmail, isEmailVerified: true, hashedRefreshToken: null }, queryRunner);
            await this.pendingEmailChangeRepository.deleteById(pending.id, queryRunner);
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
            await this.mailService.sendEmailChangedNotificationToOld(oldEmail, user.name, newEmail);
        }
        catch (err) {
            this.logger.error('[verifyEmailChange] Failed to dispatch old-address notification', err instanceof Error ? err.stack : String(err));
        }
        try {
            await this.mailService.sendEmailChangedNotificationToNew(newEmail, user.name);
        }
        catch (err) {
            this.logger.error('[verifyEmailChange] Failed to dispatch new-address confirmation', err instanceof Error ? err.stack : String(err));
        }
    }
    async cleanupExpiredPendingEmailChanges() {
        const deleted = await this.pendingEmailChangeRepository.deleteExpiredBefore(new Date());
        return { deleted };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService,
        mail_service_1.MailService,
        auth_repository_1.AuthRepository,
        password_reset_repository_1.PasswordResetRepository,
        pending_email_change_repository_1.PendingEmailChangeRepository,
        typeorm_1.DataSource])
], AuthService);
//# sourceMappingURL=auth.service.js.map