import { Role } from '@common/enums/role.enum';

export const SEED_USER_IDS = {
  SUPERADMIN_1: '00000000-0000-0000-0000-000000000001',
} as const;

export const SEED_PASSWORD = 'Test@123';

export interface SeedUser {
  id: string;
  email: string;
  fullName: string;
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
export const SEED_USERNAME_COUNT = 1;

export const SEED_USERS: SeedUser[] = [
  {
    id: SEED_USER_IDS.SUPERADMIN_1,
    email: 'superadmin1@test.com',
    fullName: 'Super Admin One',
    username: 'BB000001-2026',
    role: Role.SUPERADMIN,
    isEmailVerified: true,
  },
];
