import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Re-encodes an uploaded photo before it is written to disk.
 *
 * Phone photos arrive at 4000+ px and 3–10 MB, roughly ten times what any page
 * displays, and they carry EXIF metadata — including the GPS position of where
 * they were taken, which for an ID document or a photo shot at a seller's home
 * is not something to store or serve. Re-encoding here:
 *
 *  - caps the longest side, never upscaling;
 *  - applies the EXIF rotation, then drops all metadata (sharp writes none
 *    unless asked);
 *  - stores one predictable format per surface.
 *
 * The frontend already compresses before upload, to the same profiles, to keep
 * requests small. This is the authoritative step: anything that calls the API
 * directly is normalised all the same.
 *
 * sharp's default pixel limit (~268 MP) rejects decompression bombs; a file
 * that does not decode is refused as not-an-image rather than stored.
 */
export type ImageProfile = {
  maxEdge: number;
  format: 'jpeg' | 'webp';
  /** Encoder quality, 1–100. */
  quality: number;
};

/** Listing photos: 1920 px covers the full-width detail view and its zoom. */
export const PRODUCT_IMAGE_PROFILE: ImageProfile = {
  maxEdge: 1920,
  format: 'webp',
  quality: 80,
};

/**
 * ID documents: larger and higher quality so a reviewer can read small print.
 * JPEG, because KYC files are served and accepted as JPEG or PDF only.
 */
export const KYC_IMAGE_PROFILE: ImageProfile = {
  maxEdge: 2000,
  format: 'jpeg',
  quality: 85,
};

export type NormalizedImage = {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/webp';
  ext: '.jpg' | '.webp';
};

export async function normalizeImage(
  input: Buffer,
  profile: ImageProfile,
): Promise<NormalizedImage> {
  try {
    const pipeline = sharp(input).rotate().resize({
      width: profile.maxEdge,
      height: profile.maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (profile.format === 'webp') {
      return {
        buffer: await pipeline.webp({ quality: profile.quality }).toBuffer(),
        mimeType: 'image/webp',
        ext: '.webp',
      };
    }

    return {
      // JPEG has no alpha; flatten so a transparent PNG does not turn black.
      buffer: await pipeline
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: profile.quality, mozjpeg: true })
        .toBuffer(),
      mimeType: 'image/jpeg',
      ext: '.jpg',
    };
  } catch {
    throw new BadRequestException(
      'The uploaded file could not be read as an image',
    );
  }
}
