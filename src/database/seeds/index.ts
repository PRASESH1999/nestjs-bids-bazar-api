import dataSource from '../../config/typeorm.config';
import { seedUsers } from './users.seed';

async function runSeeds() {
  console.log('Starting database seeding...');

  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log('Database connected.');
    }

    // Run seeds in dependency order
    await seedUsers(dataSource);

    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

runSeeds();
