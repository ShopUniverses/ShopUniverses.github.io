// ========================================================
// PROMOTIONS.JS — Evento Flash Global, Ajustes y Cupones
// ========================================================
import { config } from '../config.js';
import { getDb, isFirebaseConfigured } from './firebase.js';
import { InventoryError } from './inventory.js';
import { nowIso } from './util.js';

const SETTINGS_COL = 'settings';
const SETTINGS_DOC = 'store';
const COUPONS_COL = 'coupons';

function defaultSettings() {
  return {
    flashSale: { active: false, percent: 0, title: '' },
    shippingFlat: config.store.shippingFlat,
    freeShippingMin: config.store.freeShippingMin,
    manualPaymentInfo:
      'Transferencia Nequi o Bancolombia. Envía tu comprobante por WhatsApp indicando el código de tu pedido.',
    whatsapp: config.store.whatsapp,
  };
}

/** Lee los ajustes dinámicos de la tienda (settings/store) con valores por defecto seguros. */
export async function getStoreSettings() {
  const defaults = defaultSettings();
  if (!isFirebaseConfigured()) return defaults;

  try {
    const snap = await getDb().collection(SETTINGS_COL).doc(SETTINGS_DOC).get();
    if (!snap.exists) return defaults;
    const data = snap.data() || {};
    return {
      ...defaults,
      ...data,
      flashSale: {
        ...defaults.flashSale,
        ...(data.flashSale || {}),
      },
    };
  } catch (err) {
    console.warn('[promotions] No se pudieron leer ajustes desde Firestore:', err.message);
    return defaults;
  }
}

/** Actualiza parcialmente los ajustes de la tienda en settings/store. */
export async function updateStoreSettings(patch = {}) {
  const current = await getStoreSettings();
  const next = {
    ...current,
    ...patch,
    flashSale: patch.flashSale
      ? {
          active: Boolean(patch.flashSale.active),
          percent: Math.min(90, Math.max(0, Number(patch.flashSale.percent) || 0)),
          title: String(patch.flashSale.title || '').trim(),
        }
      : current.flashSale,
    updatedAt: nowIso(),
  };

  await getDb().collection(SETTINGS_COL).doc(SETTINGS_DOC).set(next, { merge: true });
  return next;
}

/** Aplica el descuento del Evento Flash global si está activo. */
export function applyFlashSale(price, flashSale) {
  const base = Math.round(Number(price) || 0);
  const pct = Number(flashSale?.percent) || 0;
  if (flashSale?.active && pct > 0 && pct <= 90) {
    return {
      precio: Math.round((base * (100 - pct)) / 100),
      precioOriginal: base,
      descuentoPorcentaje: pct,
    };
  }
  return {
    precio: base,
    precioOriginal: null,
    descuentoPorcentaje: 0,
  };
}

/** Normaliza códigos promocionales a mayúsculas sin caracteres extraños. */
export function normalizeCouponCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

/** Crea o actualiza un cupón promocional en Firestore. */
export async function saveCoupon({ code, type, value, maxUses, minSubtotal = 0, active = true }) {
  const norm = normalizeCouponCode(code);
  if (norm.length < 3) throw new InventoryError('El código del cupón debe tener al menos 3 caracteres.');
  if (type !== 'percent' && type !== 'fixed') throw new InventoryError('Tipo de cupón inválido.');

  const numValue = Number(value);
  if (!Number.isFinite(numValue) || numValue <= 0) {
    throw new InventoryError('El valor del cupón debe ser mayor a 0.');
  }
  if (type === 'percent' && numValue > 90) {
    throw new InventoryError('El descuento porcentual máximo permitido es 90%.');
  }

  const numMaxUses = Math.floor(Number(maxUses));
  if (!Number.isFinite(numMaxUses) || numMaxUses < 1) {
    throw new InventoryError('El límite de usos debe ser al menos 1.');
  }

  const ref = getDb().collection(COUPONS_COL).doc(norm);
  const existing = await ref.get();
  const prev = existing.exists ? existing.data() : null;

  const doc = {
    code: norm,
    type,
    value: Math.round(numValue),
    maxUses: numMaxUses,
    minSubtotal: Math.max(0, Math.round(Number(minSubtotal) || 0)),
    active: Boolean(active),
    usedCount: prev ? Number(prev.usedCount) || 0 : 0,
    createdAt: prev?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await ref.set(doc);
  return doc;
}

/** Obtiene un cupón por su código o null si no existe. */
export async function getCoupon(rawCode) {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;
  const snap = await getDb().collection(COUPONS_COL).doc(code).get();
  return snap.exists ? snap.data() : null;
}

/** Lista todos los cupones configurados. */
export async function listCoupons() {
  const snap = await getDb().collection(COUPONS_COL).get();
  const list = [];
  snap.forEach((doc) => list.push(doc.data()));
  return list;
}

/** Evalúa validez y monto de descuento de un cupón sobre un subtotal dado. */
export function computeCouponDiscount(coupon, subtotal) {
  if (!coupon || !coupon.active) {
    throw new InventoryError('El cupón no es válido o está inactivo.', 404);
  }

  const maxUses = Number(coupon.maxUses) || 0;
  const usedCount = Number(coupon.usedCount) || 0;
  if (maxUses > 0 && usedCount >= maxUses) {
    throw new InventoryError('Lo sentimos, este cupón ya alcanzó el límite máximo de usos.', 409);
  }

  const minSubtotal = Number(coupon.minSubtotal) || 0;
  if (subtotal < minSubtotal) {
    throw new InventoryError('El subtotal no alcanza el monto mínimo para este cupón.', 400);
  }

  const val = Number(coupon.value) || 0;
  const discountAmount =
    coupon.type === 'percent'
      ? Math.min(subtotal, Math.round((subtotal * val) / 100))
      : Math.min(subtotal, Math.round(val));

  return {
    code: coupon.code,
    type: coupon.type,
    value: val,
    discountAmount,
    remainingUses: Math.max(0, maxUses - usedCount),
  };
}

/** Valida un cupón en Firestore contra un subtotal específico. */
export async function validateCoupon(rawCode, subtotal) {
  const coupon = await getCoupon(rawCode);
  return computeCouponDiscount(coupon, Math.max(0, Number(subtotal) || 0));
}

/** Activa o desactiva un cupón existente en Firestore. */
export async function toggleCouponActive(rawCode) {
  const coupon = await getCoupon(rawCode);
  if (!coupon) {
    throw new InventoryError('Cupón no encontrado.', 404);
  }

  const nextActive = !coupon.active;
  const updatedAt = nowIso();
  await getDb().collection(COUPONS_COL).doc(coupon.code).update({
    active: nextActive,
    updatedAt,
  });

  return { ...coupon, active: nextActive, updatedAt };
}
