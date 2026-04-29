import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
export declare class CategoriesController {
    private readonly categoriesService;
    constructor(categoriesService: CategoriesService);
    listCategories(): Promise<import("./entities/category.entity").Category[]>;
    getCategoryById(id: string): Promise<import("./entities/category.entity").Category>;
    createCategory(dto: CreateCategoryDto, icon?: Express.Multer.File): Promise<import("./entities/category.entity").Category>;
    updateCategory(id: string, dto: UpdateCategoryDto, icon?: Express.Multer.File): Promise<import("./entities/category.entity").Category>;
    deleteCategory(id: string): Promise<{
        success: boolean;
    }>;
}
