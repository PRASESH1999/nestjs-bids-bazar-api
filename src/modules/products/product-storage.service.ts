import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname, resolve } from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class ProductStorageService {
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    this.baseDir = this.configService.get<string>(
      'UPLOAD_BASE_DIR',
      './uploads',
    );
  }

  validateFiles(files: Express.Multer.File[]): void {
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          `File type '${file.mimetype}' is not allowed. Accepted: JPEG, PNG, WebP`,
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File '${file.originalname}' exceeds the 5 MB size limit`,
        );
      }
    }
  }

  async saveProductImages(
    productId: string,
    files: Express.Multer.File[],
  ): Promise<
    Array<{
      filePath: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      displayOrder: number;
    }>
  > {
    const dir = resolve(this.baseDir, 'products', productId);
    await mkdir(dir, { recursive: true });

    const results: Array<{
      filePath: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      displayOrder: number;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext =
        extname(file.originalname).toLowerCase() ||
        MIME_TO_EXT[file.mimetype] ||
        '';
      const filename = `${i}-${uuidv4()}${ext}`;
      const relativePath = `products/${productId}/${filename}`;

      await writeFile(resolve(this.baseDir, relativePath), file.buffer);

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

  getAbsolutePath(relativePath: string): string {
    const safe = relativePath.replace(/\.\./g, '');
    return resolve(this.baseDir, safe);
  }

  async deleteFile(relativePath: string): Promise<void> {
    try {
      await unlink(this.getAbsolutePath(relativePath));
    } catch {
      // Ignore — file may already be gone
    }
  }

  async deleteProductImages(
    images: Array<{ filePath: string }>,
  ): Promise<void> {
    await Promise.all(images.map((img) => this.deleteFile(img.filePath)));
  }
}
