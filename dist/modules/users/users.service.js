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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const users_repository_1 = require("./users.repository");
const role_enum_1 = require("../../common/enums/role.enum");
let UsersService = class UsersService {
    usersRepository;
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
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
        const { password, ...rest } = data;
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = this.usersRepository.createEntity({
            ...rest,
            password: hashedPassword,
            isActive: true,
        });
        return this.usersRepository.saveUser(user);
    }
    async findByEmail(email) {
        return this.usersRepository.findByEmail(email);
    }
    async findById(id) {
        return this.usersRepository.findById(id);
    }
    async updateUser(id, data) {
        const user = await this.findById(id);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
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
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_repository_1.UsersRepository])
], UsersService);
//# sourceMappingURL=users.service.js.map