import sharp from 'sharp';
import {
  KYC_IMAGE_PROFILE,
  normalizeImage,
  PRODUCT_IMAGE_PROFILE,
} from './image-normalize.util';

// A real phone-sized photo stand-in: 4000×3000 JPEG with EXIF (incl. GPS).
async function phoneJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 4000,
      height: 3000,
      channels: 3,
      background: { r: 200, g: 120, b: 80 },
    },
  })
    .jpeg({ quality: 95 })
    .withExif({
      IFD0: { Make: 'TestPhone' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '27/1 42/1 0/1' },
    })
    .toBuffer();
}

describe('normalizeImage', () => {
  it('stores a product photo as a ≤1920 px WebP with no metadata', async () => {
    const result = await normalizeImage(
      await phoneJpeg(),
      PRODUCT_IMAGE_PROFILE,
    );
    const meta = await sharp(result.buffer).metadata();

    expect(result.mimeType).toBe('image/webp');
    expect(result.ext).toBe('.webp');
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1440);
    expect(meta.exif).toBeUndefined();
  });

  it('stores a KYC photo as a ≤2000 px JPEG with the EXIF (and GPS) stripped', async () => {
    const result = await normalizeImage(await phoneJpeg(), KYC_IMAGE_PROFILE);
    const meta = await sharp(result.buffer).metadata();

    expect(result.mimeType).toBe('image/jpeg');
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(2000);
    expect(meta.exif).toBeUndefined();
  });

  it('never upscales a small image', async () => {
    const small = await sharp({
      create: { width: 600, height: 400, channels: 3, background: '#888' },
    })
      .png()
      .toBuffer();
    const result = await normalizeImage(small, PRODUCT_IMAGE_PROFILE);
    const meta = await sharp(result.buffer).metadata();

    expect(meta.width).toBe(600);
    expect(meta.height).toBe(400);
  });

  it('refuses a file that is not an image', async () => {
    await expect(
      normalizeImage(Buffer.from('not an image'), PRODUCT_IMAGE_PROFILE),
    ).rejects.toThrow('could not be read as an image');
  });
});
