import dataSource from '../../../config/typeorm.config';
import { seedUsers } from './users.seed';

async function run() {
  console.log('Starting users seeding...');

  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log('Database connected.');
    }

    await seedUsers(dataSource);

    console.log('Users seeding completed successfully.');
  } catch (error) {
    console.error('Users seeding failed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();
