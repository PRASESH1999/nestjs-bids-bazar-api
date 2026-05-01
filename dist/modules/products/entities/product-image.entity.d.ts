import { Product } from './product.entity';
export declare class ProductImage {
    id: string;
    productId: string;
    product: Product;
    filePath: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    displayOrder: number;
    createdAt: Date;
}
