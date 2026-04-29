import { CategoriesService } from './categories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
export declare class SubcategoriesController {
    private readonly categoriesService;
    constructor(categoriesService: CategoriesService);
    listSubcategories(categoryId?: string): Promise<import("./entities/subcategory.entity").Subcategory[]>;
    getSubcategoryById(id: string): Promise<import("./entities/subcategory.entity").Subcategory>;
    createSubcategory(dto: CreateSubcategoryDto, icon?: Express.Multer.File): Promise<import("./entities/subcategory.entity").Subcategory>;
    updateSubcategory(id: string, dto: UpdateSubcategoryDto, icon?: Express.Multer.File): Promise<import("./entities/subcategory.entity").Subcategory>;
    deleteSubcategory(id: string): Promise<{
        success: boolean;
    }>;
}
