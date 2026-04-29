import { BaseEntity } from "../../../common/entities/base.entity";
import { Category } from './category.entity';
export declare class Subcategory extends BaseEntity {
    categoryId: string;
    category: Category;
    name: string;
    iconPath: string | null;
    displayOrder: number;
    isActive: boolean;
}
