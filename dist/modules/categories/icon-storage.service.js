"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IconStorageService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/webp',
]);
const MAX_ICON_SIZE = 1 * 1024 * 1024;
const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
};
const ICONS_SUBPATH = 'category-icons';
let IconStorageService = class IconStorageService {
    iconsDir = (0, path_1.join)(process.cwd(), 'public', ICONS_SUBPATH);
    async saveIcon(file) {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            throw new common_1.BadRequestException(`Icon type '${file.mimetype}' is not allowed. Accepted: JPEG, PNG, SVG, WebP`);
        }
        if (file.size > MAX_ICON_SIZE) {
            throw new common_1.BadRequestException('Icon exceeds the 1 MB size limit');
        }
        const ext = (0, path_1.extname)(file.originalname).toLowerCase() ||
            MIME_TO_EXT[file.mimetype] ||
            '';
        const filename = `${(0, crypto_1.randomUUID)()}${ext}`;
        await (0, promises_1.mkdir)(this.iconsDir, { recursive: true });
        await (0, promises_1.writeFile)((0, path_1.join)(this.iconsDir, filename), file.buffer);
        return `/${ICONS_SUBPATH}/${filename}`;
    }
    async deleteIcon(iconPath) {
        if (!iconPath)
            return;
        const filename = iconPath.replace(`/${ICONS_SUBPATH}/`, '');
        try {
            await (0, promises_1.unlink)((0, path_1.join)(this.iconsDir, filename));
        }
        catch {
        }
    }
};
exports.IconStorageService = IconStorageService;
exports.IconStorageService = IconStorageService = __decorate([
    (0, common_1.Injectable)()
], IconStorageService);
//# sourceMappingURL=icon-storage.service.js.map