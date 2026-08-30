import { User } from '@modules/users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { SEED_PASSWORD, SEED_USERNAME_COUNT, SEED_USERS } from './users.data';

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
        username: user.username,
        role: user.role,
        isActive: true,
        isEmailVerified: user.isEmailVerified,
      }),
    );
    created++;
  }

  // Seeded usernames (BB000001-2026..) are hardcoded, not drawn from
  // username_seq. Advance the sequence past them so the first real
  // registration never collides with a seeded username. GREATEST guards
  // against ever moving the sequence backward if real registrations have
  // already pushed it further than the seed count.
  await dataSource.query(
    `SELECT setval('username_seq', GREATEST($1::bigint, (SELECT last_value FROM username_seq)))`,
    [SEED_USERNAME_COUNT],
  );

  console.log(`  [users.seed] Created: ${created}, Skipped: ${skipped}`);
}
