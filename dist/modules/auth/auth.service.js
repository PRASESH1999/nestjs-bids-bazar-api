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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const users_service_1 = require("../users/users.service");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const config_1 = require("@nestjs/config");
const role_permissions_map_1 = require("./role-permissions.map");
const role_enum_1 = require("../../common/enums/role.enum");
const mail_service_1 = require("../mail/mail.service");
const auth_repository_1 = require("./auth.repository");
let AuthService = class AuthService {
    usersService;
    jwtService;
    configService;
    mailService;
    authRepository;
    constructor(usersService, jwtService, configService, mailService, authRepository) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.mailService = mailService;
        this.authRepository = authRepository;
    }
    async validateUser(email, pass) {
        const user = await this.usersService.findByEmail(email);
        if (user && user.isActive && (await bcrypt.compare(pass, user.password))) {
            const { password: _, hashedRefreshToken: __, ...result } = user;
            return result;
        }
        return null;
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
        const existingUser = await this.usersService.findByEmail(data.email);
        if (existingUser) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        const { password, ...rest } = data;
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await this.usersService.create({
            ...rest,
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService,
        mail_service_1.MailService,
        auth_repository_1.AuthRepository])
], AuthService);
//# sourceMappingURL=auth.service.js.map