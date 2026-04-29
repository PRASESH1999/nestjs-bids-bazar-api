import { DataSource } from 'typeorm';
export interface CategorySeed {
    name: string;
    subcategories: string[];
}
export declare function seedCategories(dataSource: DataSource): Promise<void>;
