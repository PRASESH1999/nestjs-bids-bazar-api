import { Request } from 'express';
import { Role } from '@common/enums/role.enum';
import { Permission } from '@common/enums/permission.enum';

export interface RequestWithUser extends Request {
  user: {
    sub: string;
    email: string;
    role: Role;
    permissions: Permission[];
  };
}
