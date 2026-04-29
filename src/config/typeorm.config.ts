import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../modules/users/entities/user.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Subcategory } from '../modules/categories/entities/subcategory.entity';

config({ path: '.env.development' });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  entities: [User, Category, Subcategory],
  migrations: ['src/migrations/*.ts'],
  synchronize: true,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
