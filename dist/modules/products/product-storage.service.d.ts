import { ConfigService } from '@nestjs/config';
export declare class ProductStorageService {
    private readonly configService;
    private readonly baseDir;
    constructor(configService: ConfigService);
    validateFiles(files: Express.Multer.File[]): void;
    saveProductImages(productId: string, files: Express.Multer.File[]): Promise<Array<{
        filePath: string;
        originalFilename: string;
        mimeType: string;
        sizeBytes: number;
        displayOrder: number;
    }>>;
    getAbsolutePath(relativePath: string): string;
    deleteFile(relativePath: string): Promise<void>;
    deleteProductImages(images: Array<{
        filePath: string;
    }>): Promise<void>;
}
