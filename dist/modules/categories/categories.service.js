"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const category_entity_1 = require("./entities/category.entity");
const subcategory_entity_1 = require("./entities/subcategory.entity");
const icon_storage_service_1 = require("./icon-storage.service");
let CategoriesService = class CategoriesService {
    categoryRepo;
    subcategoryRepo;
    iconStorage;
    constructor(categoryRepo, subcategoryRepo, iconStorage) {
        this.categoryRepo = categoryRepo;
        this.subcategoryRepo = subcategoryRepo;
        this.iconStorage = iconStorage;
    }
    async listCategories(includeInactive = false) {
        return this.categoryRepo.find({
            where: includeInactive ? {} : { isActive: true },
            order: { displayOrder: 'ASC', name: 'ASC' },
        });
    }
    async listSubcategories(filters) {
        const where = {};
        if (!filters.includeInactive)
            where['isActive'] = true;
        if (filters.categoryId)
            where['categoryId'] = filters.categoryId;
        return this.subcategoryRepo.find({
            where,
            order: { displayOrder: 'ASC', name: 'ASC' },
        });
    }
    async getCategoryById(id) {
        const category = await this.categoryRepo.findOne({ where: { id } });
        if (!category)
            throw new common_1.NotFoundException('Category not found');
        return category;
    }
    async getSubcategoryById(id) {
        const subcategory = await this.subcategoryRepo.findOne({ where: { id } });
        if (!subcategory)
            throw new common_1.NotFoundException('Subcategory not found');
        return subcategory;
    }
    async createCategory(dto, iconFile) {
        await this.assertCategoryNameUnique(dto.name);
        let iconPath = null;
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
    async updateCategory(id, dto, iconFile) {
        const category = await this.getCategoryById(id);
        if (dto.name !== undefined && dto.name !== category.name) {
            await this.assertCategoryNameUnique(dto.name, id);
            category.name = dto.name;
        }
        if (dto.displayOrder !== undefined)
            category.displayOrder = dto.displayOrder;
        if (dto.isActive !== undefined)
            category.isActive = dto.isActive;
        if (iconFile) {
            await this.iconStorage.deleteIcon(category.iconPath);
            category.iconPath = await this.iconStorage.saveIcon(iconFile);
        }
        return this.categoryRepo.save(category);
    }
    async deleteCategory(id) {
        const category = await this.getCategoryById(id);
        const activeSubcategoryCount = await this.subcategoryRepo.count({
            where: { categoryId: id, isActive: true },
        });
        if (activeSubcategoryCount > 0) {
            throw new common_1.ConflictException('Cannot deactivate category with active subcategories. Deactivate subcategories first.');
        }
        category.isActive = false;
        await this.categoryRepo.save(category);
    }
    async createSubcategory(dto, iconFile) {
        const parent = await this.categoryRepo.findOne({
            where: { id: dto.categoryId, isActive: true },
        });
        if (!parent) {
            throw new common_1.NotFoundException('Parent category not found or inactive');
        }
        await this.assertSubcategoryNameUnique(dto.categoryId, dto.name);
        let iconPath = null;
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
    async updateSubcategory(id, dto, iconFile) {
        const subcategory = await this.getSubcategoryById(id);
        if (dto.categoryId !== undefined &&
            dto.categoryId !== subcategory.categoryId) {
            const parent = await this.categoryRepo.findOne({
                where: { id: dto.categoryId, isActive: true },
            });
            if (!parent) {
                throw new common_1.NotFoundException('New parent category not found or inactive');
            }
            subcategory.categoryId = dto.categoryId;
        }
        if (dto.name !== undefined && dto.name !== subcategory.name) {
            await this.assertSubcategoryNameUnique(subcategory.categoryId, dto.name, id);
            subcategory.name = dto.name;
        }
        if (dto.displayOrder !== undefined)
            subcategory.displayOrder = dto.displayOrder;
        if (dto.isActive !== undefined)
            subcategory.isActive = dto.isActive;
        if (iconFile) {
            await this.iconStorage.deleteIcon(subcategory.iconPath);
            subcategory.iconPath = await this.iconStorage.saveIcon(iconFile);
        }
        return this.subcategoryRepo.save(subcategory);
    }
    async deleteSubcategory(id) {
        const subcategory = await this.getSubcategoryById(id);
        subcategory.isActive = false;
        await this.subcategoryRepo.save(subcategory);
    }
    async assertCategoryNameUnique(name, excludeId) {
        const existing = await this.categoryRepo.findOne({ where: { name } });
        if (existing && existing.id !== excludeId) {
            throw new common_1.ConflictException(`A category with name '${name}' already exists`);
        }
    }
    async assertSubcategoryNameUnique(categoryId, name, excludeId) {
        const existing = await this.subcategoryRepo.findOne({
            where: { categoryId, name },
        });
        if (existing && existing.id !== excludeId) {
            throw new common_1.ConflictException(`A subcategory with name '${name}' already exists under this category`);
        }
    }
};
exports.CategoriesService = CategoriesService;
exports.CategoriesService = CategoriesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(category_entity_1.Category)),
    __param(1, (0, typeorm_1.InjectRepository)(subcategory_entity_1.Subcategory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        icon_storage_service_1.IconStorageService])
], CategoriesService);
//# sourceMappingURL=categories.service.js.map