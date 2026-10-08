import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname, resolve } from 'path';
import { copyFile, mkdir, unlink, writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  normalizeImage,
  PRODUCT_IMAGE_PROFILE,
} from '@common/utils/image-normalize.util';

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
      // Stored as a 1920 px WebP with no metadata, whatever was uploaded —
      // see normalizeImage. The row records what is on disk, not the upload.
      const image = await normalizeImage(file.buffer, PRODUCT_IMAGE_PROFILE);
      const filename = `${i}-${uuidv4()}${image.ext}`;
      const relativePath = `products/${productId}/${filename}`;

      await writeFile(resolve(this.baseDir, relativePath), image.buffer);

      results.push({
        filePath: relativePath,
        originalFilename: file.originalname,
        mimeType: image.mimeType,
        sizeBytes: image.buffer.length,
        displayOrder: i,
      });
    }

    return results;
  }

  /**
   * Copies another product's image files into this product's directory.
   *
   * A real copy, not a shared path: each product owns its folder, and the
   * delete paths remove files by product, so two rows pointing at one file
   * would let deleting either listing break the other's photos.
   */
  async copyProductImages(
    productId: string,
    images: Array<{
      filePath: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      displayOrder: number;
    }>,
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

    for (const image of images) {
      const ext =
        extname(image.filePath).toLowerCase() ||
        MIME_TO_EXT[image.mimeType] ||
        '';
      const relativePath = `products/${productId}/${image.displayOrder}-${uuidv4()}${ext}`;

      await copyFile(
        this.getAbsolutePath(image.filePath),
        resolve(this.baseDir, relativePath),
      );

      results.push({
        filePath: relativePath,
        originalFilename: image.originalFilename,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        displayOrder: image.displayOrder,
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
