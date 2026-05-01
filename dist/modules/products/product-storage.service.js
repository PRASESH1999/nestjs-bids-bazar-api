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
exports.ProductStorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const uuid_1 = require("uuid");
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};
let ProductStorageService = class ProductStorageService {
    configService;
    baseDir;
    constructor(configService) {
        this.configService = configService;
        this.baseDir = this.configService.get('UPLOAD_BASE_DIR', './uploads');
    }
    validateFiles(files) {
        for (const file of files) {
            if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
                throw new common_1.BadRequestException(`File type '${file.mimetype}' is not allowed. Accepted: JPEG, PNG, WebP`);
            }
            if (file.size > MAX_FILE_SIZE) {
                throw new common_1.BadRequestException(`File '${file.originalname}' exceeds the 5 MB size limit`);
            }
        }
    }
    async saveProductImages(productId, files) {
        const dir = (0, path_1.resolve)(this.baseDir, 'products', productId);
        await (0, promises_1.mkdir)(dir, { recursive: true });
        const results = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = (0, path_1.extname)(file.originalname).toLowerCase() ||
                MIME_TO_EXT[file.mimetype] ||
                '';
            const filename = `${i}-${(0, uuid_1.v4)()}${ext}`;
            const relativePath = `products/${productId}/${filename}`;
            await (0, promises_1.writeFile)((0, path_1.resolve)(this.baseDir, relativePath), file.buffer);
            results.push({
                filePath: relativePath,
                originalFilename: file.originalname,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                displayOrder: i,
            });
        }
        return results;
    }
    getAbsolutePath(relativePath) {
        const safe = relativePath.replace(/\.\./g, '');
        return (0, path_1.resolve)(this.baseDir, safe);
    }
    async deleteFile(relativePath) {
        try {
            await (0, promises_1.unlink)(this.getAbsolutePath(relativePath));
        }
        catch {
        }
    }
    async deleteProductImages(images) {
        await Promise.all(images.map((img) => this.deleteFile(img.filePath)));
    }
};
exports.ProductStorageService = ProductStorageService;
exports.ProductStorageService = ProductStorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ProductStorageService);
//# sourceMappingURL=product-storage.service.js.map