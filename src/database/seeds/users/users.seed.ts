import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@modules/users/entities/user.entity';
import { SEED_USERS, SEED_PASSWORD } from './users.data';

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
