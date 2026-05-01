import { KycService } from "../kyc/kyc.service";
import { UsersService } from "../users/users.service";
import { CategoriesService } from "../categories/categories.service";
import { MailService } from "../mail/mail.service";
import { ProductsRepository } from './products.repository';
import { ProductStorageService } from './product-storage.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { AdminListProductsQueryDto } from './dto/admin-list-products-query.dto';
import { Product } from './entities/product.entity';
export declare class ProductsService {
    private readonly productsRepository;
    private readonly productStorage;
    private readonly kycService;
    private readonly usersService;
    private readonly categoriesService;
    private readonly mailService;
    constructor(productsRepository: ProductsRepository, productStorage: ProductStorageService, kycService: KycService, usersService: UsersService, categoriesService: CategoriesService, mailService: MailService);
    createProduct(userId: string, dto: CreateProductDto, imageFiles: Express.Multer.File[]): Promise<Product>;
    updateProduct(userId: string, productId: string, dto: UpdateProductDto, newImageFiles?: Express.Multer.File[]): Promise<Product>;
    submitProduct(userId: string, productId: string): Promise<Product>;
    withdrawProduct(userId: string, productId: string): Promise<void>;
    deleteProduct(userId: string, productId: string): Promise<void>;
    listMyProducts(userId: string, query: ListProductsQueryDto): Promise<{
        data: Product[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    listPublicProducts(query: ListProductsQueryDto): Promise<{
        data: Product[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    getPublicProductById(id: string): Promise<Product>;
    getProductImageFile(imageId: string, requesterId: string | null, requesterIsAdmin: boolean): Promise<{
        absolutePath: string;
        mimeType: string;
    }>;
    getProductForOwnerOrAdmin(userId: string, productId: string, isAdmin: boolean): Promise<Product>;
    listAllProducts(query: AdminListProductsQueryDto): Promise<{
        data: Product[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    approveProduct(adminId: string, productId: string): Promise<Product>;
    rejectProduct(adminId: string, productId: string, dto: RejectProductDto): Promise<Product>;
    private assertKycApproved;
    private assertCategoryAndSubcategory;
    private findOwnedProduct;
    private assertEditable;
    private computeBiddingStartPrice;
}
