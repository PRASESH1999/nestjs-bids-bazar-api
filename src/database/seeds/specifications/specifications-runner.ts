import dataSource from '../../../config/typeorm.config';
import { seedSpecifications } from './specifications.seed';

async function run() {
  console.log('Starting specifications seeding...');

  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log('Database connected.');
    }

    await seedSpecifications(dataSource);

    console.log('Specifications seeding completed successfully.');
  } catch (error) {
    console.error('Specifications seeding failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run();
