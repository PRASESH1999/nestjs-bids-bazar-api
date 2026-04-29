export declare class IconStorageService {
    private readonly iconsDir;
    saveIcon(file: Express.Multer.File): Promise<string>;
    deleteIcon(iconPath: string | null): Promise<void>;
}
