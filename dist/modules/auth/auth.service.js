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
const config_1 = require("@nestjs/config");
const role_permissions_map_1 = require("./role-permissions.map");
const crypto_1 = require("crypto");
const role_enum_1 = require("../../common/enums/role.enum");
let AuthService = class AuthService {
    usersService;
    jwtService;
    configService;
    constructor(usersService, jwtService, configService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
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
        const permissions = role_permissions_map_1.RolePermissionsMap[user.role] || [];
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            permissions,
        };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = (0, crypto_1.randomBytes)(64).toString('hex');
        await this.usersService.updateRefreshToken(user.id, refreshToken);
        return {
            accessToken,
            refreshToken,
        };
    }
    async register(data) {
        const { password, ...rest } = data;
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await this.usersService.create({
            ...rest,
            password: hashedPassword,
            role: role_enum_1.Role.USER,
        });
        return this.login(user);
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
        const newRefreshToken = (0, crypto_1.randomBytes)(64).toString('hex');
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
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map