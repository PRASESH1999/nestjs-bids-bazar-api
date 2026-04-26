import { Role } from "../../../common/enums/role.enum";
export declare class CreateAdminDto {
    name: string;
    email: string;
    password: string;
    role: Role;
}
