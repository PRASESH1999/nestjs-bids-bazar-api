import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Product } from '@modules/products/entities/product.entity';
import { Category } from './entities/category.entity';
import { Subcategory } from './entities/subcategory.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { ReorderTaxonomyDto } from './dto/reorder-taxonomy.dto';
import { IconStorageService } from './icon-storage.service';
import {
  CategoryResponse,
  mapCategory,
  mapSubcategory,
  SubcategoryResponse,
} from './categories.mapper';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Subcategory)
    private readonly subcategoryRepo: Repository<Subcategory>,
    private readonly iconStorage: IconStorageService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────────

  async listCategories(
    includeInactive = false,
    withCounts = false,
  ): Promise<CategoryResponse[]> {
    const categories = await this.categoryRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });

    if (!withCounts) return categories.map((c) => mapCategory(c));

    // One grouped count for the whole page rather than one query per row —
    // the point of the flag is to remove N requests, not to move them here.
    // Counts follow the same active/inactive scope as the rows themselves.
    const counts = await this.countSubcategoriesByCategory(includeInactive);
    return categories.map((c) => mapCategory(c, counts.get(c.id) ?? 0));
  }

  private async countSubcategoriesByCategory(
    includeInactive: boolean,
  ): Promise<Map<string, number>> {
    const qb = this.subcategoryRepo
      .createQueryBuilder('sub')
      .select('sub.categoryId', 'categoryId')
      .addSelect('COUNT(sub.id)', 'count')
      .groupBy('sub.categoryId');

    if (!includeInactive) qb.where('sub.isActive = true');

    const rows = await qb.getRawMany<{ categoryId: string; count: string }>();
    return new Map(rows.map((r) => [r.categoryId, Number(r.count)]));
  }

  async listSubcategories(filters: {
    categoryId?: string;
    includeInactive?: boolean;
  }): Promise<SubcategoryResponse[]> {
    const where: Record<string, unknown> = {};
    if (!filters.includeInactive) where['isActive'] = true;
    if (filters.categoryId) where['categoryId'] = filters.categoryId;

    const subcategories = await this.subcategoryRepo.find({
      where,
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return subcategories.map(mapSubcategory);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async getCategoryById(id: string): Promise<CategoryResponse> {
    return mapCategory(await this.findCategoryEntityById(id));
  }

  async getSubcategoryById(id: string): Promise<SubcategoryResponse> {
    return mapSubcategory(await this.findSubcategoryEntityById(id));
  }

  async getCategoryIconFile(
    id: string,
  ): Promise<{ absolutePath: string; mimeType: string }> {
    const category = await this.findCategoryEntityById(id);
    if (!category.iconPath) throw new NotFoundException('Icon not found');
    return {
      absolutePath: this.iconStorage.getAbsolutePath(category.iconPath),
      mimeType: this.iconStorage.getMimeType(category.iconPath),
    };
  }

  async getSubcategoryIconFile(
    id: string,
  ): Promise<{ absolutePath: string; mimeType: string }> {
    const subcategory = await this.findSubcategoryEntityById(id);
    if (!subcategory.iconPath) throw new NotFoundException('Icon not found');
    return {
      absolutePath: this.iconStorage.getAbsolutePath(subcategory.iconPath),
      mimeType: this.iconStorage.getMimeType(subcategory.iconPath),
    };
  }

  async createCategory(
    dto: CreateCategoryDto,
    iconFile?: Express.Multer.File,
  ): Promise<CategoryResponse> {
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

    return mapCategory(await this.categoryRepo.save(category));
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    iconFile?: Express.Multer.File,
  ): Promise<CategoryResponse> {
    const category = await this.findCategoryEntityById(id);

    if (
      dto.name !== undefined &&
      dto.name.toLowerCase() !== category.name.toLowerCase()
    ) {
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

    return mapCategory(await this.categoryRepo.save(category));
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.findCategoryEntityById(id);

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
  ): Promise<SubcategoryResponse> {
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

    return mapSubcategory(await this.subcategoryRepo.save(subcategory));
  }

  async updateSubcategory(
    id: string,
    dto: UpdateSubcategoryDto,
    iconFile?: Express.Multer.File,
  ): Promise<SubcategoryResponse> {
    const subcategory = await this.findSubcategoryEntityById(id);

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

    if (
      dto.name !== undefined &&
      dto.name.toLowerCase() !== subcategory.name.toLowerCase()
    ) {
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

    return mapSubcategory(await this.subcategoryRepo.save(subcategory));
  }

  async deleteSubcategory(id: string): Promise<void> {
    const subcategory = await this.findSubcategoryEntityById(id);
    subcategory.isActive = false;
    await this.subcategoryRepo.save(subcategory);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findCategoryEntityById(id: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async findSubcategoryEntityById(id: string): Promise<Subcategory> {
    const subcategory = await this.subcategoryRepo.findOne({ where: { id } });
    if (!subcategory) throw new NotFoundException('Subcategory not found');
    return subcategory;
  }

  private async assertCategoryNameUnique(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.categoryRepo
      .createQueryBuilder('category')
      .where('LOWER(category.name) = :name', { name: name.toLowerCase() })
      .getOne();
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
    const existing = await this.subcategoryRepo
      .createQueryBuilder('subcategory')
      .where('subcategory.categoryId = :categoryId', { categoryId })
      .andWhere('LOWER(subcategory.name) = :name', { name: name.toLowerCase() })
      .getOne();
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A subcategory with name '${name}' already exists under this category`,
      );
    }
  }

  // ─── Bulk reorder (A18) ──────────────────────────────────────────────────

  /**
   * Applies a whole new display order in one transaction.
   *
   * All-or-nothing on purpose: a partially-applied reorder is worse than a
   * rejected one, because the list is left in an order nobody chose and the
   * client has no record of what did and did not land.
   */
  async reorderCategories(dto: ReorderTaxonomyDto): Promise<void> {
    const ids = dto.items.map((i) => i.id);
    const found = await this.categoryRepo.countBy({ id: In(ids) });
    if (found !== ids.length) {
      throw new NotFoundException('One or more categories were not found');
    }

    await this.dataSource.transaction(async (manager) => {
      for (const item of dto.items) {
        await manager.update(
          Category,
          { id: item.id },
          {
            displayOrder: item.displayOrder,
          },
        );
      }
    });
  }

  async reorderSubcategories(dto: ReorderTaxonomyDto): Promise<void> {
    const ids = dto.items.map((i) => i.id);
    const found = await this.subcategoryRepo.countBy({ id: In(ids) });
    if (found !== ids.length) {
      throw new NotFoundException('One or more subcategories were not found');
    }

    await this.dataSource.transaction(async (manager) => {
      for (const item of dto.items) {
        await manager.update(
          Subcategory,
          { id: item.id },
          {
            displayOrder: item.displayOrder,
          },
        );
      }
    });
  }

  // ─── Hard delete (A19) ───────────────────────────────────────────────────

  /**
   * Permanently removes a category that nothing references.
   *
   * `DELETE /categories/:id` is a soft delete (`isActive = false`) and that is
   * the right default — products carry a `categoryId`, so removing a row with
   * listings under it would orphan them. But a row created five minutes ago by
   * mistake has no listings and no subcategories, and until now nothing could
   * take it away. That matters more than it looks: `categories.name` is unique,
   * so a typo'd "Electroincs" permanently occupies a name the correct row can
   * never be renamed into. See OPEN-ITEMS A19.
   *
   * Refuses with 409 if anything at all references the row, active or not —
   * an inactive subcategory is still a row with a foreign key.
   */
  async hardDeleteCategory(id: string): Promise<void> {
    const category = await this.findCategoryEntityById(id);

    const subcategoryCount = await this.subcategoryRepo.countBy({
      categoryId: id,
    });
    if (subcategoryCount > 0) {
      throw new ConflictException(
        `Cannot permanently delete: ${subcategoryCount} subcategor${
          subcategoryCount === 1 ? 'y' : 'ies'
        } still reference this category. Delete them first.`,
      );
    }

    const productCount = await this.dataSource
      .getRepository(Product)
      .countBy({ categoryId: id });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot permanently delete: ${productCount} listing(s) reference this category. Deactivate it instead.`,
      );
    }

    if (category.iconPath) {
      await this.iconStorage.deleteIcon(category.iconPath);
    }
    await this.categoryRepo.remove(category);
  }

  async hardDeleteSubcategory(id: string): Promise<void> {
    const subcategory = await this.findSubcategoryEntityById(id);

    const productCount = await this.dataSource
      .getRepository(Product)
      .countBy({ subcategoryId: id });
    if (productCount > 0) {
      throw new ConflictException(
        `Cannot permanently delete: ${productCount} listing(s) reference this subcategory. Deactivate it instead.`,
      );
    }

    if (subcategory.iconPath) {
      await this.iconStorage.deleteIcon(subcategory.iconPath);
    }
    await this.subcategoryRepo.remove(subcategory);
  }
}
