import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { IconStorageService } from './icon-storage.service';
export declare class CategoriesService {
    private readonly categoryRepo;
    private readonly subcategoryRepo;
    private readonly iconStorage;
    constructor(categoryRepo: Repository<Category>, subcategoryRepo: Repository<Subcategory>, iconStorage: IconStorageService);
    listCategories(includeInactive?: boolean): Promise<Category[]>;
    listSubcategories(filters: {
        categoryId?: string;
        includeInactive?: boolean;
    }): Promise<Subcategory[]>;
    getCategoryById(id: string): Promise<Category>;
    getSubcategoryById(id: string): Promise<Subcategory>;
    createCategory(dto: CreateCategoryDto, iconFile?: Express.Multer.File): Promise<Category>;
    updateCategory(id: string, dto: UpdateCategoryDto, iconFile?: Express.Multer.File): Promise<Category>;
    deleteCategory(id: string): Promise<void>;
    createSubcategory(dto: CreateSubcategoryDto, iconFile?: Express.Multer.File): Promise<Subcategory>;
    updateSubcategory(id: string, dto: UpdateSubcategoryDto, iconFile?: Express.Multer.File): Promise<Subcategory>;
    deleteSubcategory(id: string): Promise<void>;
    private assertCategoryNameUnique;
    private assertSubcategoryNameUnique;
}
