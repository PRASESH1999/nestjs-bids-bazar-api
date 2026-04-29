import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
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

const ICONS_SUBPATH = 'category-icons';

@Injectable()
export class IconStorageService {
  private readonly iconsDir = join(process.cwd(), 'public', ICONS_SUBPATH);

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

    await mkdir(this.iconsDir, { recursive: true });
    await writeFile(join(this.iconsDir, filename), file.buffer);

    return `/${ICONS_SUBPATH}/${filename}`;
  }

  async deleteIcon(iconPath: string | null): Promise<void> {
    if (!iconPath) return;
    const filename = iconPath.replace(`/${ICONS_SUBPATH}/`, '');
    try {
      await unlink(join(this.iconsDir, filename));
    } catch {
      // File may already be gone — ignore
    }
  }
}
