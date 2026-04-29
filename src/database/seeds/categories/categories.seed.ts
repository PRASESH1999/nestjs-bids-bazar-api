import { DataSource } from 'typeorm';
import { Category } from '@modules/categories/entities/category.entity';
import { Subcategory } from '@modules/categories/entities/subcategory.entity';
import { CATEGORIES_SEED } from './categories.data';

export interface CategorySeed {
  name: string;
  subcategories: string[];
}

export async function seedCategories(dataSource: DataSource): Promise<void> {
  let createdCategories = 0;
  let createdSubcategories = 0;
  let skipped = 0;

  await dataSource.transaction(async (manager) => {
    const catRepo = manager.getRepository(Category);
    const subRepo = manager.getRepository(Subcategory);

    for (
      let displayOrder = 0;
      displayOrder < CATEGORIES_SEED.length;
      displayOrder++
    ) {
      const { name, subcategories } = CATEGORIES_SEED[displayOrder];

      let category = await catRepo.findOne({ where: { name } });
      if (!category) {
        category = await catRepo.save(
          catRepo.create({ name, displayOrder, isActive: true }),
        );
        createdCategories++;
      } else {
        skipped++;
      }

      for (
        let subOrder = 0;
        subOrder < subcategories.length;
        subOrder++
      ) {
        const subName = subcategories[subOrder];

        const existingSub = await subRepo.findOne({
          where: { categoryId: category.id, name: subName },
        });
        if (!existingSub) {
          await subRepo.save(
            subRepo.create({
              categoryId: category.id,
              name: subName,
              displayOrder: subOrder,
              isActive: true,
            }),
          );
          createdSubcategories++;
        } else {
          skipped++;
        }
      }
    }
  });

  console.log(
    `  [categories.seed] Created: ${createdCategories} categories, ${createdSubcategories} subcategories, Skipped: ${skipped}`,
  );
}
