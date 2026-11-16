// ========================================================
// INVENTORY.JS — Stock transaccional en Firestore
// --------------------------------------------------------
// Modelo de datos (compatible con el sitio actual):
//   stock/{productoId}         -> { Cantidad: number }
//   reservations/{id}          -> { items, status, tokenHash, source,
//                                   createdAt, holdUntil, closedAt, reason }
//
// Flujo:
//   reservar  -> descuenta stock y crea la reserva (status "activa")
//   confirmar -> la reserva pasa a "confirmada" (pago recibido)
//   liberar   -> devuelve stock (cancelación o expiración)
//
// "holdUntil" solo es numérico mientras la reserva está activa; al cerrarla
// se pone en null. Así la consulta de expiración no necesita índices compuestos.
// ========================================================
import crypto from 'node:crypto';
import { getDb } from './firebase.js';
import { getProduct } from './catalog.js';
import { config } from '../config.js';

const STOCK = 'stock';
const RESERVATIONS = 'reservations';
const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 20;

export class InventoryError extends Error {
  constructor(message, status = 400, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Valida y agrupa los ítems recibidos del cliente: [{ id, qty }]. */
export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new InventoryError('El carrito está vacío.');
  if (items.length > MAX_LINES) throw new InventoryError('Demasiados productos en una sola orden.');

  const merged = new Map();
  for (const it of items) {
    const id = typeof it?.id === 'string' ? it.id.trim() : '';
    const qty = Number(it?.qty);
    if (!id || !getProduct(id)) throw new InventoryError(`Producto inválido: ${id || '(vacío)'}`);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      throw new InventoryError(`Cantidad inválida para ${id}.`);
    }
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  for (const [id, qty] of merged) {
    if (qty > MAX_QTY_PER_LINE) throw new InventoryError(`Cantidad inválida para ${id}.`);
  }
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

/** Lee todo el stock vivo: { productoId: cantidad }. */
export async function getStockMap() {
  const snap = await getDb().collection(STOCK).get();
  const map = {};
  snap.forEach((doc) => {
    const n = doc.data().Cantidad;
    if (typeof n === 'number' && Number.isFinite(n)) map[doc.id] = Math.max(0, n);
  });
  return map;
}

/**
 * Reserva stock de forma atómica. Si algún producto no alcanza, no se descuenta nada.
 * Devuelve { reservationId, token, holdUntil, items }. El token solo se entrega una vez.
 */
export async function reserveStock(
  rawItems,
  { source = 'catalogo', holdMinutes = config.store.holdMinutes, reservationId = null, token: providedToken = null } = {},
) {
  const items = normalizeItems(rawItems);
  const db = getDb();
  const token = providedToken || crypto.randomBytes(24).toString('base64url');
  const resRef = reservationId ? db.collection(RESERVATIONS).doc(String(reservationId)) : db.collection(RESERVATIONS).doc();
  const now = Date.now();
  const holdUntil = now + holdMinutes * 60_000;

  return db.runTransaction(async (tx) => {
    if (reservationId) {
      const existing = await tx.get(resRef);
      if (existing.exists) {
        const data = existing.data();
        if (data.status === 'activa' && safeEqual(sha256(token), data.tokenHash)) {
          return { reservationId: resRef.id, token, holdUntil: data.holdUntil, items: data.items, idempotent: true };
        }
        throw new InventoryError('Esta sesión de ruleta ya fue utilizada.', 409);
      }
    }

    const refs = items.map((it) => db.collection(STOCK).doc(it.id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));

    const faltantes = [];
    snaps.forEach((snap, i) => {
      const disponible = snap.exists ? Number(snap.data().Cantidad) || 0 : 0;
      if (disponible < items[i].qty) faltantes.push({ id: items[i].id, disponible, solicitado: items[i].qty });
    });
    if (faltantes.length) throw new InventoryError('Stock insuficiente.', 409, faltantes);

    snaps.forEach((snap, i) => {
      tx.update(refs[i], { Cantidad: Number(snap.data().Cantidad) - items[i].qty });
    });
    tx.set(resRef, {
      items,
      status: 'activa',
      source,
      tokenHash: sha256(token),
      createdAt: now,
      holdUntil,
      closedAt: null,
      reason: null,
    });

    return { reservationId: resRef.id, token, holdUntil, items };
  });
}

/** Cierra una reserva activa. Si restock = true, devuelve las unidades al inventario. */
async function closeReservation(reservationId, { status, reason, restock, token = null }) {
  const db = getDb();
  const resRef = db.collection(RESERVATIONS).doc(String(reservationId));

  return db.runTransaction(async (tx) => {
    const resSnap = await tx.get(resRef);
    if (!resSnap.exists) throw new InventoryError('Reserva no encontrada.', 404);
    const data = resSnap.data();

    if (token !== null && !safeEqual(sha256(token), data.tokenHash)) {
      throw new InventoryError('Reserva no encontrada.', 404); // no revelamos si existe
    }
    if (data.status !== 'activa') return { changed: false, status: data.status };

    const refs = restock ? data.items.map((it) => db.collection(STOCK).doc(it.id)) : [];
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));

    snaps.forEach((snap, i) => {
      const actual = snap.exists ? Number(snap.data().Cantidad) || 0 : 0;
      tx.set(refs[i], { Cantidad: actual + data.items[i].qty }, { merge: true });
    });
    tx.update(resRef, { status, reason: reason || null, holdUntil: null, closedAt: Date.now() });
    return { changed: true, status };
  });
}

/** El cliente cancela su propia reserva (requiere el token entregado al reservar). */
export function releaseReservation(reservationId, token, reason = 'cancelada_por_cliente') {
  if (typeof token !== 'string' || token.length < 10) throw new InventoryError('Reserva no encontrada.', 404);
  return closeReservation(reservationId, { status: 'liberada', reason, restock: true, token });
}

/** Uso interno (webhook de pago / admin): la venta queda firme y el stock no vuelve. */
export function confirmReservation(reservationId, reason = 'pago_confirmado') {
  return closeReservation(reservationId, { status: 'confirmada', reason, restock: false });
}

/** Uso interno (admin): cancela y devuelve el stock sin token. */
export function cancelReservationAsAdmin(reservationId, reason = 'cancelada_por_admin') {
  return closeReservation(reservationId, { status: 'liberada', reason, restock: true });
}

/** Extiende la vigencia de reservas activas (ej. al enviar pedido por WhatsApp). */
export async function extendReservations(grants, holdMinutes = config.store.whatsappHoldHours * 60) {
  if (!Array.isArray(grants) || grants.length === 0) return { updated: 0, holdUntil: null };
  const list = grants.slice(0, MAX_LINES);
  const db = getDb();
  const targetHold = Date.now() + holdMinutes * 60_000;
  let updated = 0;
  let maxHoldUntil = null;

  for (const g of list) {
    const reservationId = typeof g?.reservationId === 'string' ? g.reservationId.trim() : '';
    const token = typeof g?.token === 'string' ? g.token : '';
    if (!reservationId || token.length < 10) continue;

    const resRef = db.collection(RESERVATIONS).doc(reservationId);
    const nextHold = await db.runTransaction(async (tx) => {
      const resSnap = await tx.get(resRef);
      if (!resSnap.exists) return null;
      const data = resSnap.data();
      if (data.status !== 'activa' || !safeEqual(sha256(token), data.tokenHash)) return null;
      const extended = Math.max(Number(data.holdUntil) || 0, targetHold);
      tx.update(resRef, { holdUntil: extended });
      return extended;
    });

    if (nextHold !== null) {
      updated++;
      if (maxHoldUntil === null || nextHold > maxHoldUntil) maxHoldUntil = nextHold;
    }
  }

  return { updated, holdUntil: maxHoldUntil };
}

/** Libera reservas vencidas. Devuelve cuántas se liberaron. */
export async function expireReservations(limit = 25) {
  const snap = await getDb()
    .collection(RESERVATIONS)
    .where('holdUntil', '<=', Date.now())
    .limit(limit)
    .get();

  let count = 0;
  for (const doc of snap.docs) {
    const r = await closeReservation(doc.id, { status: 'expirada', reason: 'tiempo_agotado', restock: true });
    if (r.changed) count++;
  }
  return count;
}

// En serverless no hay temporizadores confiables: la expiración se ejecuta de forma
// "perezosa" en cada petición relevante, como máximo una vez por minuto por instancia.
let _lastSweep = 0;
export async function sweepExpiredIfDue() {
  if (Date.now() - _lastSweep < 60_000) return 0;
  _lastSweep = Date.now();
  try {
    return await expireReservations();
  } catch (err) {
    console.error('[inventory] Error liberando reservas vencidas:', err.message);
    return 0;
  }
}

export function __resetSweepForTests() {
  _lastSweep = 0;
}

/** Uso interno (admin): fija la cantidad disponible de un producto en Firestore. */
export async function setProductStock(productId, rawQty) {
  const id = typeof productId === 'string' ? productId.trim() : '';
  if (!id || !getProduct(id)) {
    throw new InventoryError('Producto no encontrado.', 404);
  }

  const qty = Number(rawQty);
  if (!Number.isInteger(qty) || qty < 0 || qty > 10000) {
    throw new InventoryError('Cantidad de stock inválida.', 400);
  }

  await getDb().collection(STOCK).doc(id).set({ Cantidad: qty }, { merge: true });
  return { id, stock: qty };
}
