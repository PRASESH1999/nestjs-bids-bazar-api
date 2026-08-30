import { DataSource } from 'typeorm';
import { Specification } from '@modules/specifications/entities/specification.entity';
import { SPECIFICATIONS_SEED } from './specifications.data';

export async function seedSpecifications(
  dataSource: DataSource,
): Promise<void> {
  let created = 0;
  let skipped = 0;

  await dataSource.transaction(async (manager) => {
    const specRepo = manager.getRepository(Specification);

    for (
      let displayOrder = 0;
      displayOrder < SPECIFICATIONS_SEED.length;
      displayOrder++
    ) {
      const name = SPECIFICATIONS_SEED[displayOrder];

      const existing = await specRepo.findOne({ where: { name } });
      if (!existing) {
        await specRepo.save(
          specRepo.create({ name, displayOrder, isActive: true }),
        );
        created++;
      } else {
        skipped++;
      }
    }
  });

  console.log(
    `  [specifications.seed] Created: ${created} specifications, Skipped: ${skipped}`,
  );
}
