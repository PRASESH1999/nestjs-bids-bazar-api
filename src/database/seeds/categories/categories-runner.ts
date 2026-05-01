import dataSource from '../../../config/typeorm.config';
import { seedCategories } from './categories.seed';

async function run() {
  console.log('Starting categories seeding...');

  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log('Database connected.');
    }

    await seedCategories(dataSource);

    console.log('Categories seeding completed successfully.');
  } catch (error) {
    console.error('Categories seeding failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run();
