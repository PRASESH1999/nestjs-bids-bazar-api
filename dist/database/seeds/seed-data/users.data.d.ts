import { Role } from "../../../common/enums/role.enum";
export declare const SEED_USER_IDS: {
    readonly SUPERADMIN_1: "00000000-0000-0000-0000-000000000001";
    readonly SUPERADMIN_2: "00000000-0000-0000-0000-000000000002";
    readonly ADMIN_1: "00000000-0000-0000-0000-000000000003";
    readonly ADMIN_2: "00000000-0000-0000-0000-000000000004";
    readonly USER_1: "00000000-0000-0000-0000-000000000005";
    readonly USER_2: "00000000-0000-0000-0000-000000000006";
};
export declare const SEED_PASSWORD = "Seed123!Password";
export interface SeedUser {
    id: string;
    email: string;
    name: string;
    role: Role;
}
export declare const SEED_USERS: SeedUser[];
