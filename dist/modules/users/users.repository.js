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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
let UsersRepository = class UsersRepository {
    dataSource;
    repo;
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.repo = this.dataSource.getRepository(user_entity_1.User);
    }
    async findByEmail(email) {
        return this.repo.findOneBy({ email });
    }
    async findById(id) {
        return this.repo.findOneBy({ id });
    }
    async saveUser(user, queryRunner) {
        const repo = queryRunner
            ? queryRunner.manager.getRepository(user_entity_1.User)
            : this.repo;
        return repo.save(user);
    }
    async updateUser(id, data, queryRunner) {
        const repo = queryRunner
            ? queryRunner.manager.getRepository(user_entity_1.User)
            : this.repo;
        await repo.update(id, data);
    }
    async softDeleteUser(user) {
        await this.repo.softRemove(user);
    }
    async findAllPaginated(page, limit, roles) {
        const queryBuilder = this.repo.createQueryBuilder('user');
        if (roles && roles.length > 0) {
            queryBuilder.andWhere('user.role IN (:...roles)', { roles });
        }
        return queryBuilder
            .skip((page - 1) * limit)
            .take(limit)
            .orderBy('user.createdAt', 'DESC')
            .getManyAndCount();
    }
    createEntity(data) {
        return this.repo.create(data);
    }
};
exports.UsersRepository = UsersRepository;
exports.UsersRepository = UsersRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], UsersRepository);
//# sourceMappingURL=users.repository.js.map