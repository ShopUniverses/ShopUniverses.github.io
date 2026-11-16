// ========================================================
// ORDERS.JS — Órdenes Transaccionales, Cupones y Webhooks
// ========================================================
import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from './firebase.js';
import { loadCatalog, getProduct } from './catalog.js';
import {
  InventoryError,
  confirmReservation,
  cancelReservationAsAdmin,
} from './inventory.js';
import {
  getStoreSettings,
  applyFlashSale,
  normalizeCouponCode,
  computeCouponDiscount,
} from './promotions.js';
import { verifyWompiWebhookSignature } from './payments/wompi.js';
import { generateOrderCode, nowIso } from './util.js';

const ORDERS_COL = 'orders';
const STOCK_COL = 'stock';
const RESERVATIONS_COL = 'reservations';
const COUPONS_COL = 'coupons';

export const DEPARTMENTS = [
  'Amazonas',
  'Antioquia',
  'Arauca',
  'Atlántico',
  'Bogotá D.C.',
  'Bolívar',
  'Boyacá',
  'Caldas',
  'Caquetá',
  'Casanare',
  'Cauca',
  'Cesar',
  'Chocó',
  'Córdoba',
  'Cundinamarca',
  'Guainía',
  'Guaviare',
  'Huila',
  'La Guajira',
  'Magdalena',
  'Meta',
  'Nariño',
  'Norte de Santander',
  'Putumayo',
  'Quindío',
  'Risaralda',
  'San Andrés y Providencia',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
  'Vaupés',
  'Vichada',
];

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Valida los datos del comprador y el consentimiento legal colombiano (Ley 1581 / Ley 2300). */
export function validateCustomer(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new InventoryError('Datos del cliente inválidos.', 400);
  }

  const name = String(raw.name || '').trim();
  const email = String(raw.email || '').trim().toLowerCase();
  const phone = String(raw.phone || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  const document = String(raw.document || '').trim().slice(0, 30);
  const department = String(raw.department || '').trim();
  const city = String(raw.city || '').trim();
  const address = String(raw.address || '').trim();
  const notes = String(raw.notes || '').trim().slice(0, 300);

  if (name.length < 3) throw new InventoryError('Ingresa tu nombre completo (mínimo 3 caracteres).', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InventoryError('Ingresa un correo electrónico válido.', 400);
  }
  if (phoneDigits.length < 7) throw new InventoryError('Ingresa un número celular válido.', 400);
  if (!department) throw new InventoryError('Selecciona un departamento.', 400);
  if (city.length < 2) throw new InventoryError('Ingresa tu ciudad o municipio.', 400);
  if (address.length < 5) throw new InventoryError('Ingresa la dirección completa de entrega.', 400);

  // Regla SIC / Ley 1581 de 2012: consentimiento obligatorio explícito
  if (raw.acceptTerms !== true) {
    throw new InventoryError(
      'Debes aceptar la Política de Tratamiento de Información y los Términos y Condiciones.',
      400,
    );
  }

  return {
    customer: { name, email, phone, document, department, city, address, notes },
    consent: {
      acceptTerms: true,
      acceptMarketing: Boolean(raw.acceptMarketing),
      acceptedAt: nowIso(),
    },
  };
}

/**
 * Crea un pedido de forma transaccional en Firestore:
 * - Recalcula precios en servidor (incluyendo Evento Flash).
 * - Valida reservas activas y descuenta faltantes si es necesario.
 * - Valida y consume cupón promocional atómicamente.
 */
export async function createOrder({
  customer: rawCustomer,
  paymentMethod = 'wompi',
  couponCode = null,
  items: rawCartItems = [],
  clientIp = '',
}) {
  if (!['wompi', 'manual', 'whatsapp'].includes(paymentMethod)) {
    throw new InventoryError('Método de pago inválido.', 400);
  }
  if (!Array.isArray(rawCartItems) || rawCartItems.length === 0) {
    throw new InventoryError('El carrito está vacío.', 400);
  }
  if (rawCartItems.length > 60) {
    throw new InventoryError('Demasiados ítems en el pedido.', 400);
  }

  const { customer, consent } = validateCustomer(rawCustomer);
  const { config: catalogCfg } = loadCatalog();
  const settings = await getStoreSettings();

  const orderItems = [];
  const requiredQty = new Map();
  const uniqueReservations = new Map();
  let subtotal = 0;

  for (const rawItem of rawCartItems) {
    const tipo = rawItem?.tipo || 'producto';
    const origen = rawItem?.origen || 'catalogo';
    const qty = rawItem?.qty !== undefined ? Number(rawItem.qty) : 1;

    if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
      throw new InventoryError('Cantidad inválida en el carrito.', 400);
    }

    if (rawItem?.reservationId && rawItem?.reservationToken) {
      const rId = String(rawItem.reservationId).trim();
      const rTok = String(rawItem.reservationToken);
      if (rId && rTok.length >= 10 && !uniqueReservations.has(rId)) {
        uniqueReservations.set(rId, rTok);
      }
    }

    if (tipo === 'producto') {
      const id = typeof rawItem?.id === 'string' ? rawItem.id.trim() : '';
      const prod = getProduct(id);
      if (!prod) throw new InventoryError(`Producto inválido: ${id || '(vacío)'}`, 400);

      const unitPrice =
        origen === 'spin'
          ? 0
          : applyFlashSale(prod.precio_referencia, settings.flashSale).precio;

      orderItems.push({
        tipo,
        id: prod.id,
        nombre: prod.nombre,
        imagen: prod.imagen,
        origen,
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      });

      requiredQty.set(prod.id, (requiredQty.get(prod.id) || 0) + qty);
      subtotal += unitPrice * qty;
    } else if (tipo === 'spin_base' || tipo === 'spin_premium') {
      const basePrice =
        tipo === 'spin_base'
          ? Number(catalogCfg.spin.precio_base)
          : Number(catalogCfg.spin.premium_precio);
      const unitPrice = applyFlashSale(basePrice, settings.flashSale).precio;

      orderItems.push({
        tipo,
        id: tipo,
        nombre:
          tipo === 'spin_base'
            ? 'Spin ShopUniverses (Paquete Estándar)'
            : 'Spin Premium',
        imagen: '',
        origen: 'spin',
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      });

      subtotal += unitPrice * qty;
    } else {
      throw new InventoryError(`Tipo de ítem inválido: ${tipo}`, 400);
    }
  }

  const normCoupon = couponCode ? normalizeCouponCode(couponCode) : '';
  if (couponCode && !normCoupon) {
    throw new InventoryError('El cupón no es válido.', 400);
  }

  const db = getDb();
  const code = generateOrderCode();
  const holdMinutes =
    paymentMethod === 'wompi'
      ? config.store.holdMinutes
      : config.store.whatsappHoldHours * 60;
  const nowMs = Date.now();
  const holdUntil = nowMs + holdMinutes * 60_000;

  return db.runTransaction(async (tx) => {
    // 1. Todas las lecturas primero (requisito de transacciones Firestore)
    const resEntries = [...uniqueReservations.entries()];
    const resRefs = resEntries.map(([id]) => db.collection(RESERVATIONS_COL).doc(id));
    const resSnaps = await Promise.all(resRefs.map((r) => tx.get(r)));

    const prodIds = [...requiredQty.keys()];
    const stockRefs = prodIds.map((id) => db.collection(STOCK_COL).doc(id));
    const stockSnaps = await Promise.all(stockRefs.map((r) => tx.get(r)));

    const couponRef = normCoupon ? db.collection(COUPONS_COL).doc(normCoupon) : null;
    const couponSnap = couponRef ? await tx.get(couponRef) : null;

    // 2. Validar reservas activas del carrito
    const coveredQty = new Map();
    const validResIds = [];
    const validResRefs = [];

    resSnaps.forEach((snap, idx) => {
      if (!snap.exists) return;
      const data = snap.data();
      const [, token] = resEntries[idx];
      if (data.status !== 'activa' || !safeEqual(sha256(token), data.tokenHash)) return;

      validResIds.push(snap.id);
      validResRefs.push(resRefs[idx]);
      for (const it of data.items || []) {
        coveredQty.set(it.id, (coveredQty.get(it.id) || 0) + (Number(it.qty) || 0));
      }
    });

    // 3. Verificar o descontar unidades no cubiertas por reserva previa
    const missingItems = [];
    const missingUpdates = [];
    prodIds.forEach((id, i) => {
      const needed = requiredQty.get(id) || 0;
      const covered = coveredQty.get(id) || 0;
      const missing = Math.max(0, needed - covered);
      if (missing > 0) {
        const snap = stockSnaps[i];
        const disponible = snap.exists ? Number(snap.data().Cantidad) || 0 : 0;
        if (disponible < missing) {
          throw new InventoryError('Stock insuficiente.', 409, [
            { id, disponible, solicitado: missing },
          ]);
        }
        missingItems.push({ id, qty: missing });
        missingUpdates.push({ ref: stockRefs[i], nextQty: disponible - missing });
      }
    });

    // 4. Validar cupón promocional atómicamente
    let appliedCoupon = null;
    let discountAmount = 0;
    let couponData = null;

    if (couponRef) {
      couponData = couponSnap.exists ? couponSnap.data() : null;
      const discount = computeCouponDiscount(couponData, subtotal);
      appliedCoupon = {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        discountAmount: discount.discountAmount,
      };
      discountAmount = discount.discountAmount;
    }

    // 5. Calcular envío y total
    const netSubtotal = Math.max(0, subtotal - discountAmount);
    const freeMin = Number(settings.freeShippingMin) || 0;
    const flatShip = Number(settings.shippingFlat) || 0;
    const shipping =
      netSubtotal <= 0 ? 0 : freeMin > 0 && netSubtotal >= freeMin ? 0 : flatShip;
    const total = netSubtotal + shipping;

    // 6. Todas las escrituras al final de la transacción
    for (const upd of missingUpdates) {
      tx.update(upd.ref, { Cantidad: upd.nextQty });
    }

    const reservationIds = [...validResIds];
    for (const ref of validResRefs) {
      tx.update(ref, { holdUntil });
    }

    if (missingItems.length > 0) {
      const orderResId = `ord_${code}`;
      const orderResToken = crypto.randomBytes(24).toString('base64url');
      tx.set(db.collection(RESERVATIONS_COL).doc(orderResId), {
        items: missingItems,
        status: 'activa',
        source: `order_${paymentMethod}`,
        tokenHash: sha256(orderResToken),
        createdAt: nowMs,
        holdUntil,
        closedAt: null,
        reason: null,
      });
      reservationIds.push(orderResId);
    }

    if (couponRef && couponData) {
      tx.update(couponRef, { usedCount: (Number(couponData.usedCount) || 0) + 1 });
    }

    const orderDoc = {
      code,
      status: 'pendiente',
      paymentMethod,
      paymentRef: '',
      customer,
      consent,
      clientIp: String(clientIp || '').slice(0, 64),
      items: orderItems,
      reservationIds,
      flashSale: settings.flashSale?.active ? settings.flashSale : null,
      couponCode: appliedCoupon?.code || null,
      coupon: appliedCoupon,
      subtotal,
      discount: discountAmount,
      shipping,
      total,
      createdAt: nowIso(),
      expiresAt: new Date(holdUntil).toISOString(),
      holdUntil,
      paidAt: null,
      cancelReason: null,
      closedAt: null,
    };

    tx.set(db.collection(ORDERS_COL).doc(code), orderDoc);
    return orderDoc;
  });
}

/** Obtiene una orden por su código (ej. SU-12345). */
export async function getOrderByCode(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return null;
  const snap = await getDb().collection(ORDERS_COL).doc(code).get();
  return snap.exists ? snap.data() : null;
}

/** Marca una orden como pagada y confirma sus reservas de inventario (idempotente). */
export async function markOrderPaid(rawCode, { paymentRef = '', method = null } = {}) {
  const code = String(rawCode || '').trim().toUpperCase();
  const orderRef = getDb().collection(ORDERS_COL).doc(code);
  const snap = await orderRef.get();
  if (!snap.exists) throw new InventoryError('Pedido no encontrado.', 404);

  const order = snap.data();
  if (['pagado', 'enviado', 'entregado'].includes(order.status)) {
    return order;
  }

  for (const resId of order.reservationIds || []) {
    try {
      await confirmReservation(resId, 'pago_confirmado');
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }

  const patch = {
    status: 'pagado',
    paidAt: nowIso(),
    holdUntil: null,
    ...(paymentRef ? { paymentRef: String(paymentRef) } : {}),
    ...(method ? { paymentMethod: method } : {}),
  };
  await orderRef.update(patch);
  return { ...order, ...patch };
}

/** Cancela una orden, libera sus reservas de stock y restituye el uso del cupón (idempotente). */
export async function cancelOrder(rawCode, { reason = 'cancelado' } = {}) {
  const code = String(rawCode || '').trim().toUpperCase();
  const db = getDb();
  const orderRef = db.collection(ORDERS_COL).doc(code);
  const snap = await orderRef.get();
  if (!snap.exists) throw new InventoryError('Pedido no encontrado.', 404);

  const order = snap.data();
  if (order.status === 'cancelado') {
    return order;
  }
  if (['enviado', 'entregado'].includes(order.status)) {
    throw new InventoryError('No se puede cancelar un pedido enviado o entregado.', 409);
  }

  for (const resId of order.reservationIds || []) {
    try {
      await cancelReservationAsAdmin(resId, reason);
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }

  if (order.couponCode && order.status === 'pendiente') {
    const couponRef = db.collection(COUPONS_COL).doc(order.couponCode);
    await db.runTransaction(async (tx) => {
      const cSnap = await tx.get(couponRef);
      if (!cSnap.exists) return;
      const used = Number(cSnap.data().usedCount) || 0;
      tx.update(couponRef, { usedCount: Math.max(0, used - 1) });
    });
  }

  const patch = {
    status: 'cancelado',
    cancelReason: String(reason || 'cancelado'),
    holdUntil: null,
    closedAt: nowIso(),
  };
  await orderRef.update(patch);
  return { ...order, ...patch };
}

/** Procesa eventos Webhook firmados desde Wompi de forma idempotente. */
export async function handleWompiWebhook(payload, headerChecksum) {
  verifyWompiWebhookSignature(payload, headerChecksum);

  if (payload?.event !== 'transaction.updated') {
    return { ok: true, ignored: 'event_type' };
  }

  const tx = payload?.data?.transaction || {};
  const reference = String(tx.reference || '').trim().toUpperCase();
  const status = String(tx.status || '').trim().toUpperCase();
  const txId = String(tx.id || '');
  const amountInCents = Number(tx.amount_in_cents);

  const order = await getOrderByCode(reference);
  if (!order) {
    return { ok: true, ignored: 'order_not_found' };
  }

  const expectedCents = Math.round(Number(order.total) * 100);
  if (amountInCents !== expectedCents) {
    throw new InventoryError('El monto de la transacción no coincide con la orden.', 400);
  }

  if (status === 'APPROVED') {
    await markOrderPaid(order.code, { paymentRef: txId, method: 'wompi' });
  } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(status)) {
    await cancelOrder(order.code, { reason: `wompi_${status.toLowerCase()}` });
  }

  return { ok: true, code: order.code, status };
}
