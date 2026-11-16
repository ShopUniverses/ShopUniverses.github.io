// ========================================================
// CATALOG.JS — Catálogo base (fuente: data/inventario.json)
// --------------------------------------------------------
// El JSON define productos, precios, flags y stock máximo.
// El stock vivo lo define Firestore (colección "stock").
// El campo "costo" es información interna y NUNCA se expone.
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { applyFlashSale } from './promotions.js';

const CATALOG_FILE = path.join(config.dataDir, 'inventario.json');

let _cache = null;
let _mtime = 0;

/** Lee el inventario base (con caché que se invalida si el archivo cambia). */
export function loadCatalog() {
  const stat = fs.statSync(CATALOG_FILE);
  if (_cache && stat.mtimeMs === _mtime) return _cache;

  const raw = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8').replace(/^\uFEFF/, ''));
  const byId = new Map(raw.productos.map((p) => [p.id, p]));
  _cache = { config: raw.config, productos: raw.productos, byId };
  _mtime = stat.mtimeMs;
  return _cache;
}

/** Devuelve un producto por id o null. */
export function getProduct(id) {
  return loadCatalog().byId.get(id) || null;
}

/** Elimina campos internos (costo) antes de enviar al navegador. */
export function toPublicProduct(p, stock, flashSale = null) {
  const sale = applyFlashSale(p.precio_referencia, flashSale);
  return {
    id: p.id,
    nombre: p.nombre,
    imagen: p.imagen,
    precio: sale.precio,
    ...(sale.precioOriginal !== null
      ? { precio_original: sale.precioOriginal, descuento_porcentaje: sale.descuentoPorcentaje }
      : {}),
    categoria: p.categoria,
    flags: p.flags,
    peso_spin: p.peso_spin,
    stock: Number.isFinite(stock) ? stock : 0,
  };
}

/** Devuelve la lista ordenada de categorías únicas presentes en el catálogo. */
export function listCategories() {
  const cats = new Set();
  for (const p of loadCatalog().productos) {
    const c = typeof p.categoria === 'string' ? p.categoria.trim() : '';
    if (c) cats.add(c);
  }
  return [...cats].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Versión saneada del JSON para el frontend legado (sin costos). */
export function legacyPublicCatalog() {
  const { config: cfg, productos } = loadCatalog();
  return {
    config: cfg,
    productos: productos.map(({ costo, ...rest }) => rest),
  };
}
