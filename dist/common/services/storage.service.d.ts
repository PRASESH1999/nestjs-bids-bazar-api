import { ConfigService } from '@nestjs/config';
export declare class StorageService {
    private readonly configService;
    private readonly baseDir;
    constructor(configService: ConfigService);
    saveFile(file: Express.Multer.File, userId: string, label: string): Promise<string>;
    getFilePath(relativePath: string): string;
    deleteFile(relativePath: string): Promise<void>;
}
