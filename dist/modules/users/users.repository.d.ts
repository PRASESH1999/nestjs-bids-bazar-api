import { DataSource, QueryRunner } from 'typeorm';
import { User } from "./entities/user.entity";
export declare class UsersRepository {
    private dataSource;
    private readonly repo;
    constructor(dataSource: DataSource);
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    saveUser(user: User, queryRunner?: QueryRunner): Promise<User>;
    updateUser(id: string, data: Partial<User>, queryRunner?: QueryRunner): Promise<void>;
    softDeleteUser(user: User): Promise<void>;
    findAllPaginated(page: number, limit: number, roles?: string[]): Promise<[User[], number]>;
    createEntity(data: Partial<User>): User;
}
