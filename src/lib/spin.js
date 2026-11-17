// ========================================================
// SPIN.JS — Motor de Ruleta Seguro en Servidor
// --------------------------------------------------------
// El servidor realiza el sorteo ponderado usando CSPRNG (crypto.randomInt)
// sobre el stock vivo en Firestore y entrega un spinToken firmado con HMAC-SHA256.
// El stock NO se descuenta al girar (sesión volátil), sino de forma atómica
// cuando el usuario acepta los premios mediante POST /api/spin/accept.
// ========================================================
import crypto from 'node:crypto';
import { config } from '../config.js';
import { getCatalog } from './catalog.js';
import { getStockMap, reserveStock, InventoryError } from './inventory.js';

const SPIN_TTL_MS = 10 * 60_000;

function signPayload(payloadB64) {
  return crypto.createHmac('sha256', config.spinSecret).update(payloadB64).digest('base64url');
}

function safeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * Sortea los premios de una sesión completa de ruleta sin descontar stock aún.
 * @param {'estandar' | 'premium'} mode
 */
export async function rollSpinSession(mode) {
  if (mode !== 'estandar' && mode !== 'premium') {
    throw new InventoryError('Modo de ruleta inválido.', 400);
  }

  const { config: cfg, productos } = await getCatalog({ includeInactive: false });
  const stockMap = await getStockMap();

  const maxGiros = mode === 'estandar' ? Number(cfg.spin.productos_por_spin) || 5 : 1;
  const precioPaquete = mode === 'estandar' ? Number(cfg.spin.precio_base) : Number(cfg.spin.premium_precio);

  const candidates = productos.filter((p) => (mode === 'estandar' ? p.flags?.spin_estandar : p.flags?.spin_premium));
  const remaining = new Map(candidates.map((p) => [p.id, Math.max(0, Number(stockMap[p.id]) || 0)]));

  const drawn = [];
  for (let i = 0; i < maxGiros; i++) {
    const disponibles = candidates.filter((p) => (remaining.get(p.id) || 0) > 0);
    if (disponibles.length === 0) {
      throw new InventoryError('No hay suficiente stock disponible para completar los giros de esta ruleta.', 409);
    }

    const totalWeight = disponibles.reduce((acc, p) => acc + Math.max(1, Math.floor(Number(p.peso_spin) || 1)), 0);
    let r = crypto.randomInt(0, totalWeight);
    let winner = disponibles[0];
    for (const p of disponibles) {
      r -= Math.max(1, Math.floor(Number(p.peso_spin) || 1));
      if (r < 0) {
        winner = p;
        break;
      }
    }

    remaining.set(winner.id, remaining.get(winner.id) - 1);
    drawn.push(winner);
  }

  const sid = crypto.randomBytes(16).toString('base64url');
  const iat = Date.now();
  const exp = iat + SPIN_TTL_MS;
  const payload = { sid, mode, prizes: drawn.map((p) => p.id), iat, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const spinToken = `${payloadB64}.${signPayload(payloadB64)}`;

  return {
    spinToken,
    sessionId: sid,
    mode,
    precioPaquete,
    maxGiros,
    expiresAt: exp,
    prizes: drawn.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      imagen: p.imagen,
      premium: mode === 'premium',
    })),
  };
}

/**
 * Valida un spinToken firmado y reserva atómicamente los premios en Firestore.
 * @param {string} spinToken
 */
export async function acceptSpinSession(spinToken) {
  const parts = typeof spinToken === 'string' ? spinToken.split('.') : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new InventoryError('Token de ruleta inválido.', 400);
  }

  const [payloadB64, sig] = parts;
  const expectedSig = signPayload(payloadB64);
  if (!safeEqualStr(sig, expectedSig)) {
    throw new InventoryError('Token de ruleta inválido.', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new InventoryError('Token de ruleta inválido.', 400);
  }

  if (
    !payload ||
    typeof payload.sid !== 'string' ||
    !payload.sid ||
    (payload.mode !== 'estandar' && payload.mode !== 'premium') ||
    !Array.isArray(payload.prizes) ||
    payload.prizes.length === 0 ||
    typeof payload.exp !== 'number'
  ) {
    throw new InventoryError('Token de ruleta inválido.', 400);
  }

  if (Date.now() > payload.exp) {
    throw new InventoryError('La sesión de ruleta expiró. Gira de nuevo.', 410);
  }

  const { config: cfg, byId } = await getCatalog({ includeInactive: true });
  const counts = new Map();
  for (const id of payload.prizes) {
    if (typeof id !== 'string' || !byId.get(id)) {
      throw new InventoryError('Token de ruleta inválido.', 400);
    }
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const items = [...counts].map(([id, qty]) => ({ id, qty }));

  const reservationId = `spin_${payload.sid}`;
  const resToken = crypto.createHmac('sha256', config.spinSecret).update(`res:${payload.sid}`).digest('base64url');

  const reservation = await reserveStock(items, {
    source: `spin_${payload.mode}`,
    holdMinutes: config.store.cartHoldMinutes,
    reservationId,
    token: resToken,
  });

  const precioPaquete = payload.mode === 'estandar' ? Number(cfg.spin.precio_base) : Number(cfg.spin.premium_precio);

  const prizes = payload.prizes.map((id) => {
    const p = byId.get(id);
    return {
      id: p.id,
      nombre: p.nombre,
      imagen: p.imagen,
      premium: payload.mode === 'premium',
    };
  });

  return {
    reservationId: reservation.reservationId,
    token: resToken,
    holdUntil: reservation.holdUntil,
    mode: payload.mode,
    precioPaquete,
    prizes,
  };
}
