import { BaseEntity } from "../../../common/entities/base.entity";
import { Subcategory } from './subcategory.entity';
export declare class Category extends BaseEntity {
    name: string;
    iconPath: string | null;
    displayOrder: number;
    isActive: boolean;
    subcategories: Subcategory[];
}
