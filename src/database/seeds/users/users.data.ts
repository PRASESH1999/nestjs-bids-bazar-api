import { Role } from '@common/enums/role.enum';

export const SEED_USER_IDS = {
  SUPERADMIN_1: '00000000-0000-0000-0000-000000000001',
  SUPERADMIN_2: '00000000-0000-0000-0000-000000000002',
  ADMIN_1: '00000000-0000-0000-0000-000000000003',
  ADMIN_2: '00000000-0000-0000-0000-000000000004',
  USER_1: '00000000-0000-0000-0000-000000000005',
  USER_2: '00000000-0000-0000-0000-000000000006',
} as const;

export const SEED_PASSWORD = 'Seed123!Password';

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isEmailVerified: boolean;
}

export const SEED_USERS: SeedUser[] = [
  {
    id: SEED_USER_IDS.SUPERADMIN_1,
    email: 'superadmin1@test.com',
    name: 'Super Admin One',
    role: Role.SUPERADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.SUPERADMIN_2,
    email: 'superadmin2@test.com',
    name: 'Super Admin Two',
    role: Role.SUPERADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.ADMIN_1,
    email: 'admin1@test.com',
    name: 'Admin One',
    role: Role.ADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.ADMIN_2,
    email: 'admin2@test.com',
    name: 'Admin Two',
    role: Role.ADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.USER_1,
    email: 'user1@test.com',
    name: 'User One',
    role: Role.USER,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.USER_2,
    email: 'user2@test.com',
    name: 'User Two',
    role: Role.USER,
    isEmailVerified: true,
  },
];
