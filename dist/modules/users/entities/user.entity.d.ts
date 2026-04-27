import { BaseEntity } from "../../../common/entities/base.entity";
import { Role } from "../../../common/enums/role.enum";
export declare class User extends BaseEntity {
    name: string;
    email: string;
    password: string;
    role: Role;
    isActive: boolean;
    isEmailVerified: boolean;
    hashedRefreshToken: string | null;
}
