import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { AdminListProductsQueryDto } from './dto/admin-list-products-query.dto';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    listPublicProducts(query: ListProductsQueryDto): Promise<{
        data: import("./entities/product.entity").Product[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    listMyProducts(req: RequestWithUser, query: ListProductsQueryDto): Promise<{
        data: import("./entities/product.entity").Product[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    getPublicProduct(id: string): Promise<import("./entities/product.entity").Product>;
    getProductImage(imageId: string, req: RequestWithUser, res: Response): Promise<StreamableFile>;
    createProduct(req: RequestWithUser, dto: CreateProductDto, files: Express.Multer.File[]): Promise<import("./entities/product.entity").Product>;
    updateProduct(req: RequestWithUser, id: string, dto: UpdateProductDto, files: Express.Multer.File[]): Promise<import("./entities/product.entity").Product>;
    submitProduct(req: RequestWithUser, id: string): Promise<import("./entities/product.entity").Product>;
    withdrawProduct(req: RequestWithUser, id: string): Promise<{
        message: string;
    }>;
    deleteProduct(req: RequestWithUser, id: string): Promise<{
        message: string;
    }>;
    listAllProducts(query: AdminListProductsQueryDto): Promise<{
        data: import("./entities/product.entity").Product[];
        meta: {
            page: number;
            limit: number;
            total: number;
        };
    }>;
    getAdminProduct(req: RequestWithUser, id: string): Promise<import("./entities/product.entity").Product>;
    approveProduct(req: RequestWithUser, id: string): Promise<import("./entities/product.entity").Product>;
    rejectProduct(req: RequestWithUser, id: string, dto: RejectProductDto): Promise<import("./entities/product.entity").Product>;
}
