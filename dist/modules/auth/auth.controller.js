"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const public_decorator_1 = require("../../common/decorators/public.decorator");
const local_auth_guard_1 = require("../../common/guards/local-auth.guard");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const swagger_1 = require("@nestjs/swagger");
const api_responses_1 = require("../../common/swagger/api-responses");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const register_dto_1 = require("./dto/register.dto");
const resend_verification_dto_1 = require("./dto/resend-verification.dto");
const verify_email_query_dto_1 = require("./dto/verify-email-query.dto");
let AuthController = class AuthController {
    authService;
    jwtService;
    configService;
    constructor(authService, jwtService, configService) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(registerDto) {
        return this.authService.register(registerDto);
    }
    async login(req, res) {
        const { accessToken, refreshToken } = await this.authService.login(req.user);
        this.setRefreshTokenCookie(res, refreshToken);
        return { accessToken };
    }
    async verifyEmail(query) {
        await this.authService.verifyEmail(query.token);
        return { message: 'Email verified successfully. You can now log in.' };
    }
    async resendVerification(dto) {
        await this.authService.resendVerification(dto.email);
        return {
            message: 'If your email exists and is unverified, a new verification email has been sent.',
        };
    }
    async refresh(req, res) {
        const refreshToken = req.cookies['refreshToken'];
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Refresh token not found');
        }
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new common_1.UnauthorizedException('Access token missing');
        }
        const accessToken = authHeader.slice(7);
        const decoded = this.jwtService.decode(accessToken);
        const userId = decoded?.sub;
        if (!userId) {
            throw new common_1.UnauthorizedException('Invalid access token');
        }
        const tokens = await this.authService.refresh(refreshToken, userId);
        this.setRefreshTokenCookie(res, tokens.refreshToken);
        return { accessToken: tokens.accessToken };
    }
    async logout(req, res) {
        await this.authService.logout(req.user.sub);
        const nodeEnv = this.configService.get('NODE_ENV');
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: nodeEnv === 'production',
            sameSite: 'strict',
        });
        return { message: 'Logged out successfully' };
    }
    setRefreshTokenCookie(res, token) {
        const expiresIn = 7 * 24 * 60 * 60 * 1000;
        const nodeEnv = this.configService.get('NODE_ENV');
        res.cookie('refreshToken', token, {
            httpOnly: true,
            secure: nodeEnv === 'production' || nodeEnv === 'staging',
            sameSite: 'strict',
            maxAge: expiresIn,
        });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Register a new user' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Account created — verification email sent.',
        ...(0, api_responses_1.MessageResponse)('Account created. Please check your email to verify your account before logging in.'),
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R400),
    (0, swagger_1.ApiResponse)(api_responses_1.R409),
    (0, swagger_1.ApiResponse)(api_responses_1.R429),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 3600000 } }),
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(local_auth_guard_1.LocalAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Login with email and password' }),
    (0, swagger_1.ApiBody)({ type: login_dto_1.LoginDto }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Login successful. Sets HttpOnly refreshToken cookie. Returns short-lived accessToken.',
        ...api_responses_1.AccessTokenResponse,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Validation failed.', ...api_responses_1.R400 }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Invalid credentials or inactive account.',
        ...api_responses_1.R401,
    }),
    (0, swagger_1.ApiResponse)({
        status: 403,
        description: 'Email not verified — send to /auth/resend-verification.',
        schema: {
            type: 'object',
            properties: {
                data: { type: 'null', example: null },
                meta: { type: 'null', example: null },
                error: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', example: 'EMAIL_NOT_VERIFIED' },
                        message: {
                            type: 'string',
                            example: 'Please verify your email before logging in.',
                        },
                        statusCode: { type: 'number', example: 403 },
                    },
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R429),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 900000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Verify email with token' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Email verified successfully.',
        ...(0, api_responses_1.MessageResponse)('Email verified successfully. You can now log in.'),
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R400),
    (0, swagger_1.ApiResponse)(api_responses_1.R404),
    (0, swagger_1.ApiResponse)(api_responses_1.R410),
    (0, common_1.Get)('verify-email'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_email_query_dto_1.VerifyEmailQueryDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Resend verification email' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Response is always the same regardless of whether the email exists (prevents user enumeration).',
        ...(0, api_responses_1.MessageResponse)('If your email exists and is unverified, a new verification email has been sent.'),
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R400),
    (0, swagger_1.ApiResponse)(api_responses_1.R429),
    (0, throttler_1.Throttle)({ default: { limit: 3, ttl: 3600000 } }),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('resend-verification'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resend_verification_dto_1.ResendVerificationDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendVerification", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token using refresh token cookie' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'New accessToken issued. The refreshToken cookie is rotated (old token invalidated).',
        ...api_responses_1.AccessTokenResponse,
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Missing refresh token cookie, missing/invalid access token, or refresh token mismatch (possible token theft).',
        ...api_responses_1.R401,
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R429),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 900000 } }),
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Logout and clear refresh token' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Logged out. refreshToken cookie cleared. Discard the accessToken client-side.',
        ...(0, api_responses_1.MessageResponse)('Logged out successfully'),
    }),
    (0, swagger_1.ApiResponse)(api_responses_1.R401),
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Response)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map