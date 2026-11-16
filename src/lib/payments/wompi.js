// ========================================================
// PAYMENTS/WOMPI.JS — Integración segura con Wompi Bancolombia
// --------------------------------------------------------
// Firma de integridad SHA-256 para checkout y validación
// criptográfica de webhooks (x-event-checksum / signature.checksum).
// ========================================================
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { InventoryError } from '../inventory.js';

/** Indica si Wompi cuenta con llave pública y secreto de integridad configurados. */
export function isWompiConfigured() {
  return Boolean(config.wompi.publicKey && config.wompi.integritySecret);
}

/** Firma de integridad SHA-256 requerida por Wompi Web Checkout. */
export function computeWompiIntegritySignature({
  reference,
  amountInCents,
  currency = 'COP',
  integritySecret = config.wompi.integritySecret,
}) {
  const raw = `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Construye los parámetros y URL segura de redirección a Wompi Web Checkout. */
export function buildWompiCheckoutConfig(order) {
  const amountInCents = Math.round(Number(order.total) * 100);
  const currency = 'COP';
  const reference = order.code;
  const signatureIntegrity = computeWompiIntegritySignature({
    reference,
    amountInCents,
    currency,
  });
  const redirectUrl = `${config.siteUrl}/pedido/${encodeURIComponent(order.code)}`;

  const params = new URLSearchParams({
    'public-key': config.wompi.publicKey,
    currency,
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': signatureIntegrity,
    'redirect-url': redirectUrl,
  });

  if (order.customer?.email) params.set('customer-data:email', order.customer.email);
  if (order.customer?.name) params.set('customer-data:full-name', order.customer.name);
  if (order.customer?.phone) params.set('customer-data:phone-number', order.customer.phone);

  return {
    publicKey: config.wompi.publicKey,
    currency,
    amountInCents,
    reference,
    signatureIntegrity,
    redirectUrl,
    checkoutUrl: `https://checkout.wompi.co/p/?${params.toString()}`,
  };
}

function resolvePropPath(obj, propPath) {
  const parts = String(propPath || '').split('.');
  let cur = obj;
  for (const key of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Verifica la firma SHA-256 de los eventos Webhook enviados por Wompi. */
export function verifyWompiWebhookSignature(
  payload,
  headerChecksum,
  eventsSecret = config.wompi.eventsSecret,
) {
  if (!eventsSecret) {
    throw new InventoryError('Secreto de eventos Wompi no configurado.', 503);
  }

  const props = payload?.signature?.properties;
  const timestamp = payload?.timestamp;
  const checksum = String(headerChecksum || payload?.signature?.checksum || '')
    .trim()
    .toLowerCase();

  if (!Array.isArray(props) || timestamp === undefined || timestamp === null || !checksum) {
    throw new InventoryError('Firma de webhook inválida.', 401);
  }

  let concat = '';
  for (const prop of props) {
    const val = resolvePropPath(payload?.data, prop);
    concat += val === undefined || val === null ? '' : String(val);
  }
  concat += `${timestamp}${eventsSecret}`;

  const expected = crypto.createHash('sha256').update(concat).digest('hex').toLowerCase();
  const a = Buffer.from(checksum, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new InventoryError('Firma de webhook inválida.', 401);
  }

  return true;
}
