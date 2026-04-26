import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@modules/users/entities/user.entity';
import { Role } from '@common/enums/role.enum';

export const SEED_USER_IDS = {
  SUPERADMIN_1: '00000000-0000-0000-0000-000000000001',
  SUPERADMIN_2: '00000000-0000-0000-0000-000000000002',
  ADMIN_1: '00000000-0000-0000-0000-000000000003',
  ADMIN_2: '00000000-0000-0000-0000-000000000004',
  USER_1: '00000000-0000-0000-0000-000000000005',
  USER_2: '00000000-0000-0000-0000-000000000006',
} as const;

const SEED_PASSWORD = 'Seed123!Password';

interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const SEED_USERS: SeedUser[] = [
  {
    id: SEED_USER_IDS.SUPERADMIN_1,
    email: 'superadmin1@test.com',
    name: 'Super Admin One',
    role: Role.SUPERADMIN,
  },
  {
    id: SEED_USER_IDS.SUPERADMIN_2,
    email: 'superadmin2@test.com',
    name: 'Super Admin Two',
    role: Role.SUPERADMIN,
  },
  {
    id: SEED_USER_IDS.ADMIN_1,
    email: 'admin1@test.com',
    name: 'Admin One',
    role: Role.ADMIN,
  },
  {
    id: SEED_USER_IDS.ADMIN_2,
    email: 'admin2@test.com',
    name: 'Admin Two',
    role: Role.ADMIN,
  },
  {
    id: SEED_USER_IDS.USER_1,
    email: 'user1@test.com',
    name: 'User One',
    role: Role.USER,
  },
  {
    id: SEED_USER_IDS.USER_2,
    email: 'user2@test.com',
    name: 'User Two',
    role: Role.USER,
  },
];

export async function seedUsers(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(User);
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);

  let created = 0;
  let skipped = 0;

  for (const user of SEED_USERS) {
    const existing = await repo.findOne({ where: { email: user.email } });

    if (existing) {
      skipped++;
      continue;
    }

    await repo.save(
      repo.create({
        id: user.id,
        email: user.email,
        password: hashedPassword,
        name: user.name,
        role: user.role,
        isActive: true,
      }),
    );
    created++;
  }

  console.log(`  [users.seed] Created: ${created}, Skipped: ${skipped}`);
}
