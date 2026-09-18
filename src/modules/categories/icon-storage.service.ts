import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname, resolve } from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
]);

const MAX_ICON_SIZE = 1 * 1024 * 1024; // 1 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
};

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const ICONS_SUBPATH = 'category-icons';

@Injectable()
export class IconStorageService {
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    this.baseDir = this.configService.get<string>(
      'UPLOAD_BASE_DIR',
      './uploads',
    );
  }

  async saveIcon(file: Express.Multer.File): Promise<string> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Icon type '${file.mimetype}' is not allowed. Accepted: JPEG, PNG, SVG, WebP`,
      );
    }
    if (file.size > MAX_ICON_SIZE) {
      throw new BadRequestException('Icon exceeds the 1 MB size limit');
    }

    const ext =
      extname(file.originalname).toLowerCase() ||
      MIME_TO_EXT[file.mimetype] ||
      '';
    const filename = `${randomUUID()}${ext}`;
    const relativePath = `${ICONS_SUBPATH}/${filename}`;

    await mkdir(resolve(this.baseDir, ICONS_SUBPATH), { recursive: true });
    await writeFile(resolve(this.baseDir, relativePath), file.buffer);

    return relativePath;
  }

  getMimeType(iconPath: string): string {
    return (
      EXT_TO_MIME[extname(iconPath).toLowerCase()] || 'application/octet-stream'
    );
  }

  getAbsolutePath(iconPath: string): string {
    // Strip a legacy leading slash (old paths were stored as `/category-icons/…`
    // for direct static-asset serving) and any traversal attempts.
    const safe = iconPath.replace(/^\/+/, '').replace(/\.\./g, '');
    return resolve(this.baseDir, safe);
  }

  async deleteIcon(iconPath: string | null): Promise<void> {
    if (!iconPath) return;
    try {
      await unlink(this.getAbsolutePath(iconPath));
    } catch {
      // File may already be gone — ignore
    }
  }
}
