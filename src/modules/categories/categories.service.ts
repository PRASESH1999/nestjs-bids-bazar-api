import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { IconStorageService } from './icon-storage.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Subcategory)
    private readonly subcategoryRepo: Repository<Subcategory>,
    private readonly iconStorage: IconStorageService,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────────

  async listCategories(includeInactive = false): Promise<Category[]> {
    return this.categoryRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async listSubcategories(filters: {
    categoryId?: string;
    includeInactive?: boolean;
  }): Promise<Subcategory[]> {
    const where: Record<string, unknown> = {};
    if (!filters.includeInactive) where['isActive'] = true;
    if (filters.categoryId) where['categoryId'] = filters.categoryId;

    return this.subcategoryRepo.find({
      where,
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async getSubcategoryById(id: string): Promise<Subcategory> {
    const subcategory = await this.subcategoryRepo.findOne({ where: { id } });
    if (!subcategory) throw new NotFoundException('Subcategory not found');
    return subcategory;
  }

  async createCategory(
    dto: CreateCategoryDto,
    iconFile?: Express.Multer.File,
  ): Promise<Category> {
    await this.assertCategoryNameUnique(dto.name);

    let iconPath: string | null = null;
    if (iconFile) {
      iconPath = await this.iconStorage.saveIcon(iconFile);
    }

    const category = this.categoryRepo.create({
      name: dto.name,
      iconPath,
      displayOrder: dto.displayOrder ?? 0,
    });

    return this.categoryRepo.save(category);
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    iconFile?: Express.Multer.File,
  ): Promise<Category> {
    const category = await this.getCategoryById(id);

    if (dto.name !== undefined && dto.name !== category.name) {
      await this.assertCategoryNameUnique(dto.name, id);
      category.name = dto.name;
    }

    if (dto.displayOrder !== undefined)
      category.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;

    if (iconFile) {
      await this.iconStorage.deleteIcon(category.iconPath);
      category.iconPath = await this.iconStorage.saveIcon(iconFile);
    }

    return this.categoryRepo.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.getCategoryById(id);

    const activeSubcategoryCount = await this.subcategoryRepo.count({
      where: { categoryId: id, isActive: true },
    });
    if (activeSubcategoryCount > 0) {
      throw new ConflictException(
        'Cannot deactivate category with active subcategories. Deactivate subcategories first.',
      );
    }

    category.isActive = false;
    await this.categoryRepo.save(category);
  }

  async createSubcategory(
    dto: CreateSubcategoryDto,
    iconFile?: Express.Multer.File,
  ): Promise<Subcategory> {
    const parent = await this.categoryRepo.findOne({
      where: { id: dto.categoryId, isActive: true },
    });
    if (!parent) {
      throw new NotFoundException('Parent category not found or inactive');
    }

    await this.assertSubcategoryNameUnique(dto.categoryId, dto.name);

    let iconPath: string | null = null;
    if (iconFile) {
      iconPath = await this.iconStorage.saveIcon(iconFile);
    }

    const subcategory = this.subcategoryRepo.create({
      categoryId: dto.categoryId,
      name: dto.name,
      iconPath,
      displayOrder: dto.displayOrder ?? 0,
    });

    return this.subcategoryRepo.save(subcategory);
  }

  async updateSubcategory(
    id: string,
    dto: UpdateSubcategoryDto,
    iconFile?: Express.Multer.File,
  ): Promise<Subcategory> {
    const subcategory = await this.getSubcategoryById(id);

    if (
      dto.categoryId !== undefined &&
      dto.categoryId !== subcategory.categoryId
    ) {
      const parent = await this.categoryRepo.findOne({
        where: { id: dto.categoryId, isActive: true },
      });
      if (!parent) {
        throw new NotFoundException(
          'New parent category not found or inactive',
        );
      }
      subcategory.categoryId = dto.categoryId;
    }

    if (dto.name !== undefined && dto.name !== subcategory.name) {
      await this.assertSubcategoryNameUnique(
        subcategory.categoryId,
        dto.name,
        id,
      );
      subcategory.name = dto.name;
    }

    if (dto.displayOrder !== undefined)
      subcategory.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) subcategory.isActive = dto.isActive;

    if (iconFile) {
      await this.iconStorage.deleteIcon(subcategory.iconPath);
      subcategory.iconPath = await this.iconStorage.saveIcon(iconFile);
    }

    return this.subcategoryRepo.save(subcategory);
  }

  async deleteSubcategory(id: string): Promise<void> {
    const subcategory = await this.getSubcategoryById(id);
    subcategory.isActive = false;
    await this.subcategoryRepo.save(subcategory);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async assertCategoryNameUnique(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.categoryRepo.findOne({ where: { name } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A category with name '${name}' already exists`,
      );
    }
  }

  private async assertSubcategoryNameUnique(
    categoryId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.subcategoryRepo.findOne({
      where: { categoryId, name },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A subcategory with name '${name}' already exists under this category`,
      );
    }
  }
}
