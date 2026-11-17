// ========================================================
// CATALOG.JS — Catálogo Dinámico (Firestore + Semilla JSON)
// --------------------------------------------------------
// `data/inventario.json` actúa como semilla inicial y respaldo offline.
// Una vez inicializada, la colección `products` en Firestore es la
// autoridad del catálogo editable desde el panel `/admin/productos`.
// El campo "costo" es interno y NUNCA se expone al navegador.
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getDb, isFirebaseConfigured } from './firebase.js';
import { applyFlashSale } from './promotions.js';
import { slugify, nowIso } from './util.js';

const CATALOG_FILE = path.join(config.dataDir, 'inventario.json');
const PRODUCTS_COL = 'products';
const STOCK_COL = 'stock';

let _seedCache = null;
let _seedMtime = 0;

let _fsCache = null;
let _fsCacheDb = null;
let _fsCacheAt = 0;

function catalogError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function normalizeProductDoc(id, data = {}) {
  return {
    id: data.id || id,
    nombre: String(data.nombre || '').trim(),
    imagen: String(data.imagen || '/assets/img/perfil/2.webp').trim(),
    precio_referencia: Math.max(0, Math.round(Number(data.precio_referencia) || 0)),
    costo: Math.max(0, Math.round(Number(data.costo) || 0)),
    categoria: String(data.categoria || 'Otros').trim() || 'Otros',
    flags: {
      catalogo: Boolean(data.flags?.catalogo),
      spin_estandar: Boolean(data.flags?.spin_estandar),
      spin_premium: Boolean(data.flags?.spin_premium),
    },
    peso_spin: Math.max(1, Math.floor(Number(data.peso_spin) || 1)),
    activo: data.activo !== false,
    position: Number.isFinite(Number(data.position)) ? Number(data.position) : 9999,
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
  };
}

/** Lee el archivo semilla `data/inventario.json` de forma síncrona. */
export function loadCatalog() {
  const stat = fs.statSync(CATALOG_FILE);
  if (_seedCache && stat.mtimeMs === _seedMtime) return _seedCache;

  const raw = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8').replace(/^\uFEFF/, ''));
  const byId = new Map(raw.productos.map((p) => [p.id, p]));
  _seedCache = { config: raw.config, productos: raw.productos, byId };
  _seedMtime = stat.mtimeMs;
  return _seedCache;
}

/** Devuelve un producto de la semilla síncrona por id o null. */
export function getProduct(id) {
  return loadCatalog().byId.get(id) || null;
}

/** Invalida la caché en memoria del catálogo en Firestore. */
export function invalidateCatalogCache() {
  _fsCache = null;
  _fsCacheDb = null;
  _fsCacheAt = 0;
}

/** Lee el catálogo vivo desde Firestore (con respaldo a `inventario.json` si está vacío). */
export async function getCatalog({ includeInactive = false } = {}) {
  const seed = loadCatalog();
  if (!isFirebaseConfigured()) {
    const productos = seed.productos
      .map((p, idx) => normalizeProductDoc(p.id, { ...p, position: idx, activo: true }))
      .filter((p) => includeInactive || p.activo !== false);
    return {
      config: seed.config,
      productos,
      byId: new Map(productos.map((p) => [p.id, p])),
      source: 'seed',
    };
  }

  const db = getDb();
  const ttlMs = process.env.NODE_TEST_CONTEXT ? 0 : 15_000;
  let allProducts = null;
  let fromFirestore = false;

  if (_fsCache && _fsCacheDb === db && Date.now() - _fsCacheAt < ttlMs) {
    allProducts = _fsCache.allProducts;
    fromFirestore = _fsCache.fromFirestore;
  } else {
    try {
      const snap = await db.collection(PRODUCTS_COL).get();
      if (snap.size > 0) {
        allProducts = snap.docs
          .map((d) => normalizeProductDoc(d.id, d.data()))
          .sort((a, b) => a.position - b.position || a.nombre.localeCompare(b.nombre, 'es'));
        fromFirestore = true;
      } else {
        allProducts = seed.productos.map((p, idx) =>
          normalizeProductDoc(p.id, { ...p, position: idx, activo: true }),
        );
        fromFirestore = false;
      }
      _fsCache = { allProducts, fromFirestore };
      _fsCacheDb = db;
      _fsCacheAt = Date.now();
    } catch (err) {
      console.warn('[catalog] Error leyendo products desde Firestore, usando semilla:', err.message);
      allProducts = seed.productos.map((p, idx) =>
        normalizeProductDoc(p.id, { ...p, position: idx, activo: true }),
      );
      fromFirestore = false;
    }
  }

  const productos = includeInactive
    ? allProducts
    : allProducts.filter((p) => p.activo !== false);

  return {
    config: seed.config,
    productos,
    byId: new Map(productos.map((p) => [p.id, p])),
    source: fromFirestore ? 'firestore' : 'seed',
  };
}

/** Devuelve un producto vivo desde Firestore (o semilla) por id o null. */
export async function getProductAsync(id, { includeInactive = true } = {}) {
  const cleanId = typeof id === 'string' ? id.trim() : '';
  if (!cleanId) return null;
  const cat = await getCatalog({ includeInactive });
  return cat.byId.get(cleanId) || null;
}

/** Siembra `products` en Firestore desde `data/inventario.json` si la colección está vacía. */
export async function ensureCatalogSeeded() {
  if (!isFirebaseConfigured()) return { seeded: 0, alreadySeeded: false };

  const db = getDb();
  const existing = await db.collection(PRODUCTS_COL).limit(1).get();
  if (existing.size > 0) return { seeded: 0, alreadySeeded: true };

  const seed = loadCatalog();
  const stockSnap = await db.collection(STOCK_COL).get();
  const existingStockIds = new Set(stockSnap.docs.map((d) => d.id));
  const now = nowIso();

  const batch = db.batch();
  seed.productos.forEach((p, idx) => {
    const doc = normalizeProductDoc(p.id, {
      ...p,
      position: idx,
      activo: true,
      createdAt: now,
      updatedAt: now,
    });
    batch.set(db.collection(PRODUCTS_COL).doc(doc.id), doc);

    if (!existingStockIds.has(doc.id)) {
      batch.set(db.collection(STOCK_COL).doc(doc.id), {
        Cantidad: Math.max(0, Math.floor(Number(p.stock) || 0)),
      });
    }
  });

  await batch.commit();
  invalidateCatalogCache();
  return { seeded: seed.productos.length, alreadySeeded: false };
}

/** Crea o actualiza un producto en Firestore `products/{id}`. */
export async function upsertProduct(raw, { isNew = false } = {}) {
  await ensureCatalogSeeded();

  const nombre = String(raw?.nombre || '').trim();
  if (nombre.length < 2) {
    throw catalogError('El nombre del producto debe tener al menos 2 caracteres.', 400);
  }

  const id = isNew ? slugify(raw?.id || nombre) : String(raw?.id || '').trim();
  if (!id) {
    throw catalogError('El identificador (slug) del producto no es válido.', 400);
  }

  const precio = Math.round(Number(raw?.precio_referencia ?? raw?.precio));
  if (!Number.isFinite(precio) || precio < 0) {
    throw catalogError('El precio de venta debe ser un número mayor o igual a 0.', 400);
  }

  const costo = Math.round(Number(raw?.costo || 0));
  if (!Number.isFinite(costo) || costo < 0) {
    throw catalogError('El costo del producto debe ser mayor o igual a 0.', 400);
  }

  const pesoSpin = Math.max(1, Math.floor(Number(raw?.peso_spin) || 1));
  const categoria = String(raw?.categoria || 'Otros').trim() || 'Otros';

  const db = getDb();
  const ref = db.collection(PRODUCTS_COL).doc(id);
  const existingSnap = await ref.get();
  if (isNew && existingSnap.exists) {
    throw catalogError(`Ya existe un producto con el identificador "${id}".`, 409);
  }

  const prev = existingSnap.exists ? existingSnap.data() : null;
  const imagen =
    String(raw?.imagen || '').trim() ||
    prev?.imagen ||
    '/assets/img/perfil/2.webp';

  const now = nowIso();
  const doc = {
    id,
    nombre,
    imagen,
    precio_referencia: precio,
    costo,
    categoria,
    flags: {
      catalogo: Boolean(raw?.flags?.catalogo),
      spin_estandar: Boolean(raw?.flags?.spin_estandar),
      spin_premium: Boolean(raw?.flags?.spin_premium),
    },
    peso_spin: pesoSpin,
    activo: raw?.activo === undefined ? (prev ? prev.activo !== false : true) : Boolean(raw.activo),
    position: Number.isFinite(Number(raw?.position))
      ? Number(raw.position)
      : prev?.position ?? Date.now(),
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };

  await ref.set(doc, { merge: true });
  invalidateCatalogCache();
  return doc;
}

/** Activa o desactiva la visibilidad pública de un producto en Firestore. */
export async function toggleProductActive(id) {
  await ensureCatalogSeeded();
  const cleanId = String(id || '').trim();
  if (!cleanId) throw catalogError('Producto no encontrado.', 404);
  const ref = getDb().collection(PRODUCTS_COL).doc(cleanId);
  const snap = await ref.get();
  if (!snap.exists) throw catalogError('Producto no encontrado.', 404);

  const nextActive = snap.data().activo === false;
  const updatedAt = nowIso();
  await ref.update({ activo: nextActive, updatedAt });
  invalidateCatalogCache();
  return normalizeProductDoc(cleanId, { ...snap.data(), activo: nextActive, updatedAt });
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

/** Devuelve la lista ordenada de categorías de la semilla síncrona. */
export function listCategories() {
  const cats = new Set();
  for (const p of loadCatalog().productos) {
    const c = typeof p.categoria === 'string' ? p.categoria.trim() : '';
    if (c) cats.add(c);
  }
  return [...cats].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Devuelve la lista ordenada de categorías únicas de los productos activos en Firestore. */
export async function listCategoriesAsync() {
  const cats = new Set();
  const { productos } = await getCatalog({ includeInactive: false });
  for (const p of productos) {
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
