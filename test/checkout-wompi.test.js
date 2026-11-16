import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { config } from '../src/config.js';
import { createFakeFirestore } from './helpers/fake-firestore.js';
import { __setDbForTests } from '../src/lib/firebase.js';
import { updateStoreSettings, saveCoupon } from '../src/lib/promotions.js';
import { cancelOrder } from '../src/lib/orders.js';
import { computeWompiIntegritySignature } from '../src/lib/payments/wompi.js';
import { app } from '../src/server.js';

let server;
let base;
let db;
let prevWompi;

const stockOf = (id) => db._data.get(`stock/${id}`)?.Cantidad;
const orderOf = (code) => db._data.get(`orders/${code}`);
const couponOf = (code) => db._data.get(`coupons/${code}`);

function validCustomer(overrides = {}) {
  return {
    name: 'Laura Gómez',
    email: 'laura@ejemplo.com',
    phone: '3001234567',
    document: '1010123456',
    department: 'Bogotá D.C.',
    city: 'Bogotá',
    address: 'Calle 100 # 15-20',
    notes: '',
    acceptTerms: true,
    acceptMarketing: false,
    ...overrides,
  };
}

function signWompiEvent(payload, secret) {
  const props = payload.signature.properties;
  let concat = '';
  for (const prop of props) {
    const parts = prop.split('.');
    let cur = payload.data;
    for (const k of parts) cur = cur[k];
    concat += String(cur);
  }
  concat += `${payload.timestamp}${secret}`;
  return crypto.createHash('sha256').update(concat).digest('hex');
}

before(async () => {
  prevWompi = { ...config.wompi };
  config.wompi.env = 'sandbox';
  config.wompi.publicKey = 'pub_test_shopuniverses';
  config.wompi.integritySecret = 'test_integrity_secret_123';
  config.wompi.eventsSecret = 'test_events_secret_456';

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  Object.assign(config.wompi, prevWompi);
  server.close();
});

beforeEach(() => {
  db = createFakeFirestore({
    stock: {
      '11-minas-bts': { Cantidad: 10 },
      'atari-sapito': { Cantidad: 5 },
    },
  });
  __setDbForTests(db);
});

const post = (path, body, headers = {}) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('Evento Flash global aplica descuento en /api/catalog y muestra banner en /', async () => {
  await updateStoreSettings({
    flashSale: { active: true, percent: 20, title: 'Promo Universo' },
  });

  const catRes = await fetch(`${base}/api/catalog`);
  assert.equal(catRes.status, 200);
  const cat = await catRes.json();

  assert.equal(cat.flashSale.active, true);
  assert.equal(cat.flashSale.percent, 20);

  const bts = cat.productos.find((p) => p.id === '11-minas-bts');
  // Precio original en inventario.json: 3000 -> con 20% = 2400
  assert.equal(bts.precio_original, 3000);
  assert.equal(bts.precio, 2400);
  assert.equal(bts.descuento_porcentaje, 20);

  const homeRes = await fetch(`${base}/`);
  assert.equal(homeRes.status, 200);
  const html = await homeRes.text();
  assert.ok(html.includes('Promo Universo'));
  assert.ok(html.includes('20% DE DESCUENTO'));
});

test('Cupón con límite de usos (maxUses: 2) valida, restringe el tercer intento y libera uso al cancelar', async () => {
  await saveCoupon({
    code: 'PRIMEROS2',
    type: 'percent',
    value: 10,
    maxUses: 2,
    active: true,
  });

  const valRes = await post('/api/coupons/validate', { code: 'primeros2', subtotal: 10000 });
  assert.equal(valRes.status, 200);
  const valBody = await valRes.json();
  assert.equal(valBody.code, 'PRIMEROS2');
  assert.equal(valBody.discountAmount, 1000);
  assert.equal(valBody.remainingUses, 2);

  const orderBody = () => ({
    paymentMethod: 'manual',
    couponCode: 'PRIMEROS2',
    customer: validCustomer(),
    items: [{ tipo: 'producto', id: 'atari-sapito', qty: 1, origen: 'catalogo' }],
  });

  const o1Res = await post('/api/orders', orderBody());
  assert.equal(o1Res.status, 201);
  const o1 = await o1Res.json();
  assert.equal(o1.order.discount, 500); // 10% de 5000
  assert.equal(couponOf('PRIMEROS2').usedCount, 1);

  const o2Res = await post('/api/orders', orderBody());
  assert.equal(o2Res.status, 201);
  assert.equal(couponOf('PRIMEROS2').usedCount, 2);

  // Tercer intento debe ser rechazado con 409
  const o3Res = await post('/api/orders', orderBody());
  assert.equal(o3Res.status, 409);
  const o3Err = await o3Res.json();
  assert.ok(o3Err.error.includes('límite máximo'));
  assert.equal(stockOf('atari-sapito'), 3); // no descontó en el intento fallido

  // Al cancelar o1, se libera un uso del cupón y vuelve su stock
  await cancelOrder(o1.order.code, { reason: 'prueba' });
  assert.equal(couponOf('PRIMEROS2').usedCount, 1);
  assert.equal(stockOf('atari-sapito'), 4);

  const o4Res = await post('/api/orders', orderBody());
  assert.equal(o4Res.status, 201);
  assert.equal(couponOf('PRIMEROS2').usedCount, 2);
});

test('Cumplimiento Ley 1581: POST /api/orders sin acceptTerms=true devuelve 400', async () => {
  const res = await post('/api/orders', {
    paymentMethod: 'manual',
    customer: validCustomer({ acceptTerms: false }),
    items: [{ tipo: 'producto', id: '11-minas-bts', qty: 1, origen: 'catalogo' }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error.includes('Política de Tratamiento de Información'));
  assert.equal(stockOf('11-minas-bts'), 10);
});

test('Flujo Wompi: firma de integridad SHA-256, webhook firmado, idempotencia y reversión por DECLINED', async () => {
  // 1. Crear orden con Wompi
  const createRes = await post('/api/orders', {
    paymentMethod: 'wompi',
    customer: validCustomer(),
    items: [{ tipo: 'producto', id: '11-minas-bts', qty: 2, origen: 'catalogo' }],
  });
  assert.equal(createRes.status, 201);
  const { order, wompi } = await createRes.json();

  assert.equal(order.status, 'pendiente');
  assert.equal(stockOf('11-minas-bts'), 8);
  assert.ok(wompi && wompi.checkoutUrl.includes('https://checkout.wompi.co/p/'));

  const expectedIntegrity = computeWompiIntegritySignature({
    reference: order.code,
    amountInCents: order.total * 100,
    currency: 'COP',
    integritySecret: config.wompi.integritySecret,
  });
  assert.equal(wompi.signatureIntegrity, expectedIntegrity);

  // Vista /pedido/:code renderiza correctamente
  const pageRes = await fetch(`${base}/pedido/${order.code}`);
  assert.equal(pageRes.status, 200);
  const pageHtml = await pageRes.text();
  assert.ok(pageHtml.includes(order.code));

  // 2. Webhook con firma inválida -> 401
  const approvedPayload = {
    event: 'transaction.updated',
    timestamp: 1731770000,
    data: {
      transaction: {
        id: 'wompi-tx-001',
        status: 'APPROVED',
        reference: order.code,
        amount_in_cents: order.total * 100,
      },
    },
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
    },
  };

  const badHook = await post('/api/payments/wompi/webhook', approvedPayload, {
    'x-event-checksum': '0'.repeat(64),
  });
  assert.equal(badHook.status, 401);
  assert.equal(orderOf(order.code).status, 'pendiente');

  // 3. Webhook APPROVED con firma SHA-256 válida -> pagado (idempotente)
  const validChecksum = signWompiEvent(approvedPayload, config.wompi.eventsSecret);
  const okHook1 = await post('/api/payments/wompi/webhook', approvedPayload, {
    'x-event-checksum': validChecksum,
  });
  assert.equal(okHook1.status, 200);
  assert.equal(orderOf(order.code).status, 'pagado');
  assert.equal(orderOf(order.code).paymentRef, 'wompi-tx-001');
  assert.equal(stockOf('11-minas-bts'), 8);

  const okHook2 = await post('/api/payments/wompi/webhook', approvedPayload, {
    'x-event-checksum': validChecksum,
  });
  assert.equal(okHook2.status, 200);
  assert.equal(orderOf(order.code).status, 'pagado');
  assert.equal(stockOf('11-minas-bts'), 8);

  // 4. Segunda orden rechazada (DECLINED) -> cancela y devuelve stock a Firestore
  const res2 = await post('/api/orders', {
    paymentMethod: 'wompi',
    customer: validCustomer(),
    items: [{ tipo: 'producto', id: 'atari-sapito', qty: 3, origen: 'catalogo' }],
  });
  assert.equal(res2.status, 201);
  const { order: order2 } = await res2.json();
  assert.equal(stockOf('atari-sapito'), 2);

  const declinedPayload = {
    event: 'transaction.updated',
    timestamp: 1731770100,
    data: {
      transaction: {
        id: 'wompi-tx-002',
        status: 'DECLINED',
        reference: order2.code,
        amount_in_cents: order2.total * 100,
      },
    },
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
    },
  };
  const declinedChecksum = signWompiEvent(declinedPayload, config.wompi.eventsSecret);
  const declHook = await post('/api/payments/wompi/webhook', declinedPayload, {
    'x-event-checksum': declinedChecksum,
  });
  assert.equal(declHook.status, 200);
  assert.equal(orderOf(order2.code).status, 'cancelado');
  assert.equal(stockOf('atari-sapito'), 5);
});
