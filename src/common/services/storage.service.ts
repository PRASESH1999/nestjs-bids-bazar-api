import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname, resolve } from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

@Injectable()
export class StorageService {
  private readonly baseDir: string;

  constructor(private readonly configService: ConfigService) {
    this.baseDir = this.configService.get<string>(
      'UPLOAD_BASE_DIR',
      './uploads',
    );
  }

  async saveFile(
    file: Express.Multer.File,
    userId: string,
    label: string,
  ): Promise<string> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Accepted: JPEG, PNG, PDF`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File '${label}' exceeds the 5 MB size limit`,
      );
    }

    const ext =
      extname(file.originalname).toLowerCase() ||
      MIME_TO_EXT[file.mimetype] ||
      '';
    const filename = `${label}-${Date.now()}${ext}`;
    // Normalise to forward slashes so paths stored in DB are OS-agnostic
    const relativePath = `kyc/${userId}/${filename}`;

    await mkdir(resolve(this.baseDir, 'kyc', userId), { recursive: true });
    await writeFile(resolve(this.baseDir, relativePath), file.buffer);

    return relativePath;
  }

  getFilePath(relativePath: string): string {
    // Prevent path traversal
    const safe = relativePath.replace(/\.\./g, '');
    return resolve(this.baseDir, safe);
  }

  async deleteFile(relativePath: string): Promise<void> {
    try {
      await unlink(this.getFilePath(relativePath));
    } catch {
      // Ignore — file may already be gone
    }
  }
}
