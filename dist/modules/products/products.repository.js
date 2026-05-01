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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const product_entity_1 = require("./entities/product.entity");
const product_image_entity_1 = require("./entities/product-image.entity");
let ProductsRepository = class ProductsRepository {
    dataSource;
    productRepo;
    imageRepo;
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.productRepo = this.dataSource.getRepository(product_entity_1.Product);
        this.imageRepo = this.dataSource.getRepository(product_image_entity_1.ProductImage);
    }
    createProduct(data) {
        return this.productRepo.create(data);
    }
    async saveProduct(product) {
        return this.productRepo.save(product);
    }
    async findById(id) {
        return this.productRepo.findOne({
            where: { id },
            relations: ['images'],
            order: { images: { displayOrder: 'ASC' } },
        });
    }
    async findByIdWithoutImages(id) {
        return this.productRepo.findOneBy({ id });
    }
    async deleteProduct(product) {
        await this.productRepo.softRemove(product);
    }
    async findPaginated(page, limit, filters) {
        const qb = this.buildFilterQuery(filters);
        return qb
            .leftJoinAndSelect('product.images', 'images', 'images.displayOrder = 0')
            .orderBy('product.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
    }
    async findPaginatedWithOwner(page, limit, filters) {
        const qb = this.buildFilterQuery(filters);
        return qb
            .leftJoinAndSelect('product.images', 'images', 'images.displayOrder = 0')
            .orderBy('product.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();
    }
    createImage(data) {
        return this.imageRepo.create(data);
    }
    async saveImages(images) {
        return this.imageRepo.save(images);
    }
    async findImageById(id) {
        return this.imageRepo.findOneBy({ id });
    }
    async findImagesByProductId(productId) {
        return this.imageRepo.find({
            where: { productId },
            order: { displayOrder: 'ASC' },
        });
    }
    async deleteImagesByProductId(productId) {
        await this.imageRepo.delete({ productId });
    }
    buildFilterQuery(filters) {
        const qb = this.productRepo.createQueryBuilder('product');
        if (filters.statuses && filters.statuses.length > 0) {
            qb.andWhere('product.status IN (:...statuses)', {
                statuses: filters.statuses,
            });
        }
        else if (filters.status) {
            qb.andWhere('product.status = :status', { status: filters.status });
        }
        if (filters.ownerId) {
            qb.andWhere('product.ownerId = :ownerId', { ownerId: filters.ownerId });
        }
        if (filters.categoryId) {
            qb.andWhere('product.categoryId = :categoryId', {
                categoryId: filters.categoryId,
            });
        }
        if (filters.subcategoryId) {
            qb.andWhere('product.subcategoryId = :subcategoryId', {
                subcategoryId: filters.subcategoryId,
            });
        }
        if (filters.condition) {
            qb.andWhere('product.condition = :condition', {
                condition: filters.condition,
            });
        }
        if (filters.keyword) {
            qb.andWhere('(LOWER(product.title) LIKE :kw OR LOWER(product.description) LIKE :kw)', { kw: `%${filters.keyword.toLowerCase()}%` });
        }
        return qb;
    }
};
exports.ProductsRepository = ProductsRepository;
exports.ProductsRepository = ProductsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ProductsRepository);
//# sourceMappingURL=products.repository.js.map