// ========================================================
// IMAGES.JS — Procesamiento y Optimización WebP con Sharp
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config.js';

export const SIZES = {
  lg: { width: 1200, quality: 82 },
  md: { width: 640, quality: 78 },
};

/** Convierte y redimensiona un Buffer de imagen a WebP optimizado. */
export async function optimizeImageBuffer(buffer, { width = 640, quality = 80 } = {}) {
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

/** Guarda una imagen subida en dos resoluciones WebP (lg y md) dentro de data/uploads. */
export async function saveImage(buffer) {
  const id = crypto.randomBytes(8).toString('hex');
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const base = sharp(buffer, { failOn: 'none' }).rotate();

  for (const [suffix, { width, quality }] of Object.entries(SIZES)) {
    await base
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toFile(path.join(config.uploadsDir, `${id}-${suffix}.webp`));
  }
  return id;
}

/** Elimina las variantes WebP guardadas para un id dado. */
export function deleteImageFiles(id) {
  for (const suffix of Object.keys(SIZES)) {
    fs.rmSync(path.join(config.uploadsDir, `${id}-${suffix}.webp`), { force: true });
  }
}

/** Construye la URL pública de una imagen guardada en uploads. */
export const imageUrl = (id, size = 'lg') => (id ? `/uploads/${id}-${size}.webp` : '');
