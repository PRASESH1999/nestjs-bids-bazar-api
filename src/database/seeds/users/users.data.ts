import { Role } from '@common/enums/role.enum';

export const SEED_USER_IDS = {
  SUPERADMIN_1: '00000000-0000-0000-0000-000000000001',
  SUPERADMIN_2: '00000000-0000-0000-0000-000000000002',
  ADMIN_1: '00000000-0000-0000-0000-000000000003',
  ADMIN_2: '00000000-0000-0000-0000-000000000004',
  USER_1: '00000000-0000-0000-0000-000000000005',
  USER_2: '00000000-0000-0000-0000-000000000006',
} as const;

export const SEED_PASSWORD = 'Test@123';

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: Role;
  isEmailVerified: boolean;
}

// Seeded usernames follow the same BB000001-2026 format real registration/
// admin-creation generates, but are hardcoded here rather than pulled from
// username_seq (seeds write directly via the repository). SEED_USERNAME_COUNT
// below must match the highest sequence number used here — the seed runner
// advances username_seq past it so the first real registration never
// collides with a seeded username.
export const SEED_USERNAME_COUNT = 6;

export const SEED_USERS: SeedUser[] = [
  {
    id: SEED_USER_IDS.SUPERADMIN_1,
    email: 'superadmin1@test.com',
    name: 'Super Admin One',
    username: 'BB000001-2026',
    role: Role.SUPERADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.SUPERADMIN_2,
    email: 'superadmin2@test.com',
    name: 'Super Admin Two',
    username: 'BB000002-2026',
    role: Role.SUPERADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.ADMIN_1,
    email: 'admin1@test.com',
    name: 'Admin One',
    username: 'BB000003-2026',
    role: Role.ADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.ADMIN_2,
    email: 'admin2@test.com',
    name: 'Admin Two',
    username: 'BB000004-2026',
    role: Role.ADMIN,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.USER_1,
    email: 'user1@test.com',
    name: 'User One',
    username: 'BB000005-2026',
    role: Role.USER,
    isEmailVerified: true,
  },
  {
    id: SEED_USER_IDS.USER_2,
    email: 'user2@test.com',
    name: 'User Two',
    username: 'BB000006-2026',
    role: Role.USER,
    isEmailVerified: true,
  },
];
