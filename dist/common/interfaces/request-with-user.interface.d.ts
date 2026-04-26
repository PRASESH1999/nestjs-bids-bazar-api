import { Request } from 'express';
import { Role } from "../enums/role.enum";
import { Permission } from "../enums/permission.enum";
export interface RequestWithUser extends Request {
    user: {
        sub: string;
        email: string;
        role: Role;
        permissions: Permission[];
    };
}
