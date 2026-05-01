import { DataSource } from 'typeorm';
import { ProductStatus } from "../../common/enums/product-status.enum";
import { ItemCondition } from "../../common/enums/item-condition.enum";
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
export interface ProductFilters {
    categoryId?: string;
    subcategoryId?: string;
    condition?: ItemCondition;
    keyword?: string;
    status?: ProductStatus;
    ownerId?: string;
    statuses?: ProductStatus[];
}
export declare class ProductsRepository {
    private readonly dataSource;
    private readonly productRepo;
    private readonly imageRepo;
    constructor(dataSource: DataSource);
    createProduct(data: Partial<Product>): Product;
    saveProduct(product: Product): Promise<Product>;
    findById(id: string): Promise<Product | null>;
    findByIdWithoutImages(id: string): Promise<Product | null>;
    deleteProduct(product: Product): Promise<void>;
    findPaginated(page: number, limit: number, filters: ProductFilters): Promise<[Product[], number]>;
    findPaginatedWithOwner(page: number, limit: number, filters: ProductFilters): Promise<[Product[], number]>;
    createImage(data: Partial<ProductImage>): ProductImage;
    saveImages(images: ProductImage[]): Promise<ProductImage[]>;
    findImageById(id: string): Promise<ProductImage | null>;
    findImagesByProductId(productId: string): Promise<ProductImage[]>;
    deleteImagesByProductId(productId: string): Promise<void>;
    private buildFilterQuery;
}
