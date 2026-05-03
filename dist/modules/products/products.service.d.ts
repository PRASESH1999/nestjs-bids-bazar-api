import { CategoriesService } from "../categories/categories.service";
import { KycService } from "../kyc/kyc.service";
import { MailService } from "../mail/mail.service";
import { UsersService } from "../users/users.service";
import { AdminListProductsQueryDto } from './dto/admin-list-products-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductStorageService } from './product-storage.service';
import { ProductsRepository } from './products.repository';
export type ProductImageResponse = {
    id: string;
    displayOrder: number;
    mimeType: string;
    url: string;
};
export type ProductResponse = Omit<Product, 'images'> & {
    images: ProductImageResponse[];
};
export declare class ProductsService {
    private readonly productsRepository;
    private readonly productStorage;
    private readonly kycService;
    private readonly usersService;
    private readonly categoriesService;
    private readonly mailService;
    constructor(productsRepository: ProductsRepository, productStorage: ProductStorageService, kycService: KycService, usersService: UsersService, categoriesService: CategoriesService, mailService: MailService);
    createProduct(userId: string, dto: CreateProductDto, imageFiles: Express.Multer.File[]): Promise<ProductResponse>;
    updateProduct(userId: string, productId: string, dto: UpdateProductDto, newImageFiles?: Express.Multer.File[]): Promise<ProductResponse>;
    submitProduct(userId: string, productId: string): Promise<ProductResponse>;
    withdrawProduct(userId: string, productId: string): Promise<void>;
    deleteProduct(userId: string, productId: string): Promise<void>;
    listMyProducts(userId: string, query: ListProductsQueryDto): Promise<{
        data: ProductResponse[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    listPublicProducts(query: ListProductsQueryDto): Promise<{
        data: ProductResponse[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    getPublicProductById(id: string, requesterId?: string | null): Promise<ProductResponse>;
    getProductImageFile(imageId: string, requesterId: string | null, requesterIsAdmin: boolean): Promise<{
        absolutePath: string;
        mimeType: string;
    }>;
    getProductForOwnerOrAdmin(userId: string, productId: string, isAdmin: boolean): Promise<ProductResponse>;
    listAllProducts(query: AdminListProductsQueryDto): Promise<{
        data: ProductResponse[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    approveProduct(adminId: string, productId: string): Promise<ProductResponse>;
    rejectProduct(adminId: string, productId: string, dto: RejectProductDto): Promise<ProductResponse>;
    private assertKycApproved;
    private assertCategoryAndSubcategory;
    private findOwnedProduct;
    private assertEditable;
    private computeBiddingStartPrice;
    private mapProduct;
}
