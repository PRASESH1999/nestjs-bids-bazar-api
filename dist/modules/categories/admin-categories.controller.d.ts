import { CategoriesService } from './categories.service';
export declare class AdminCategoriesController {
    private readonly categoriesService;
    constructor(categoriesService: CategoriesService);
    listAllCategories(includeInactive?: string): Promise<import("./entities/category.entity").Category[]>;
    listAllSubcategories(categoryId?: string, includeInactive?: string): Promise<import("./entities/subcategory.entity").Subcategory[]>;
}
