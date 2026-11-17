// ========================================================
// IMAGES.JS — Procesamiento y Optimización WebP con Sharp
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { config } from '../config.js';
import { getDb } from './firebase.js';
import { nowIso } from './util.js';

const MEDIA_COL = 'media';
const MAX_MEDIA_BYTES = 850_000;

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

/** Optimiza una imagen subida a WebP y la guarda en Firestore (`media/{id}`) para entorno serverless. */
export async function saveMediaToFirestore(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw Object.assign(new Error('Archivo de imagen vacío o inválido.'), { status: 400 });
  }

  let out;
  try {
    // Verificar que Sharp pueda decodificar el archivo como imagen real
    await sharp(buffer).metadata();
    out = await optimizeImageBuffer(buffer, { width: 640, quality: 78 });
    if (out.length > 700_000) {
      out = await optimizeImageBuffer(buffer, { width: 520, quality: 60 });
    }
  } catch {
    throw Object.assign(new Error('Archivo de imagen no válido. Usa JPG, PNG o WebP.'), { status: 400 });
  }

  if (out.length > MAX_MEDIA_BYTES) {
    throw Object.assign(new Error('La imagen supera el límite permitido tras optimizarla.'), { status: 400 });
  }

  const id = crypto.randomBytes(8).toString('hex');
  await getDb().collection(MEDIA_COL).doc(id).set({
    id,
    contentType: 'image/webp',
    size: out.length,
    data: out.toString('base64'),
    createdAt: nowIso(),
  });

  return { id, url: `/media/${id}.webp`, size: out.length };
}

/** Obtiene una imagen WebP almacenada en Firestore `media/{id}` o null. */
export async function getMediaById(id) {
  const cleanId = String(id || '').trim();
  if (!/^[a-f0-9]{16}$/.test(cleanId)) return null;

  const snap = await getDb().collection(MEDIA_COL).doc(cleanId).get();
  if (!snap.exists || !snap.data()?.data) return null;

  return {
    contentType: snap.data().contentType || 'image/webp',
    buffer: Buffer.from(snap.data().data, 'base64'),
  };
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
