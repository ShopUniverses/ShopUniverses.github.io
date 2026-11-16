import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './helpers/fake-firestore.js';
import { __setDbForTests } from '../src/lib/firebase.js';
import { reserveStock } from '../src/lib/inventory.js';
import { rollSpinSession } from '../src/lib/spin.js';
import { app } from '../src/server.js';

let server;
let base;
let db;

const stockOf = (id) => db._data.get(`stock/${id}`)?.Cantidad;
const reservationOf = (id) => db._data.get(`reservations/${id}`);

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
  db = createFakeFirestore({
    stock: {
      '11-minas-bts': { Cantidad: 3 },
      '11-minas-carita-feliz': { Cantidad: 4 },
      'atari-sapito': { Cantidad: 3 },
      'borrador-aguacate': { Cantidad: 2 },
      'capybara-post-it': { Cantidad: 3 },
      'carpeta-pandas': { Cantidad: 2 },
      'blister-bts-x5pcs': { Cantidad: 2 },
    },
  });
  __setDbForTests(db);
});

const post = (path, body) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

test('POST /api/spin/roll estandar devuelve 5 premios con stock > 0, spinToken firmado y NO descuenta stock', async () => {
  const beforeSnapshot = {
    bts: stockOf('11-minas-bts'),
    cara: stockOf('11-minas-carita-feliz'),
    sapito: stockOf('atari-sapito'),
    aguacate: stockOf('borrador-aguacate'),
    capybara: stockOf('capybara-post-it'),
    pandas: stockOf('carpeta-pandas'),
  };

  const res = await post('/api/spin/roll', { mode: 'estandar' });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.mode, 'estandar');
  assert.equal(body.maxGiros, 5);
  assert.equal(body.prizes.length, 5);
  assert.ok(typeof body.spinToken === 'string' && body.spinToken.includes('.'));
  assert.ok(body.prizes.every((p) => stockOf(p.id) > 0));

  // No debe descontar stock al girar (sesión volátil)
  assert.equal(stockOf('11-minas-bts'), beforeSnapshot.bts);
  assert.equal(stockOf('11-minas-carita-feliz'), beforeSnapshot.cara);
  assert.equal(stockOf('atari-sapito'), beforeSnapshot.sapito);
  assert.equal(stockOf('borrador-aguacate'), beforeSnapshot.aguacate);
  assert.equal(stockOf('capybara-post-it'), beforeSnapshot.capybara);
  assert.equal(stockOf('carpeta-pandas'), beforeSnapshot.pandas);
});

test('un producto con stock = 1 nunca aparece 2 veces en la misma sesión de 5 giros', async () => {
  db = createFakeFirestore({
    stock: {
      '11-minas-bts': { Cantidad: 1 },
      '11-minas-carita-feliz': { Cantidad: 1 },
      'atari-sapito': { Cantidad: 1 },
      'borrador-aguacate': { Cantidad: 1 },
      'capybara-post-it': { Cantidad: 1 },
    },
  });
  __setDbForTests(db);

  const res = await post('/api/spin/roll', { mode: 'estandar' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.prizes.length, 5);

  const ids = body.prizes.map((p) => p.id);
  assert.equal(new Set(ids).size, 5);
});

test('POST /api/spin/accept con spinToken válido descuenta exactamente los premios y entrega reserva', async () => {
  const rollRes = await post('/api/spin/roll', { mode: 'estandar' });
  assert.equal(rollRes.status, 200);
  const roll = await rollRes.json();

  const expectedCounts = new Map();
  for (const p of roll.prizes) {
    expectedCounts.set(p.id, (expectedCounts.get(p.id) || 0) + 1);
  }
  const initialStock = new Map();
  for (const id of expectedCounts.keys()) {
    initialStock.set(id, stockOf(id));
  }

  const acceptRes = await post('/api/spin/accept', { spinToken: roll.spinToken });
  assert.equal(acceptRes.status, 201);
  const accepted = await acceptRes.json();

  assert.ok(accepted.reservationId && accepted.token);
  assert.equal(accepted.mode, 'estandar');
  assert.equal(accepted.prizes.length, 5);

  for (const [id, qty] of expectedCounts) {
    assert.equal(stockOf(id), initialStock.get(id) - qty);
  }
});

test('manipular payload o firma del spinToken devuelve 400', async () => {
  const roll = await rollSpinSession('estandar');
  const [payloadB64, sig] = roll.spinToken.split('.');

  // Payload alterado con misma firma
  const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  decoded.prizes = ['blister-bts-x5pcs'];
  const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
  const resPayload = await post('/api/spin/accept', { spinToken: `${forgedPayload}.${sig}` });
  assert.equal(resPayload.status, 400);

  // Firma alterada
  const badSig = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a');
  const resSig = await post('/api/spin/accept', { spinToken: `${payloadB64}.${badSig}` });
  assert.equal(resSig.status, 400);
});

test('reutilizar el mismo spinToken después de liberar la reserva devuelve 409', async () => {
  const roll = await rollSpinSession('premium');

  const first = await post('/api/spin/accept', { spinToken: roll.spinToken });
  assert.equal(first.status, 201);
  const accepted = await first.json();
  assert.equal(stockOf('blister-bts-x5pcs'), 1);

  const rel = await post('/api/stock/release', {
    reservationId: accepted.reservationId,
    token: accepted.token,
  });
  assert.equal(rel.status, 200);
  assert.equal(stockOf('blister-bts-x5pcs'), 2);

  const replay = await post('/api/spin/accept', { spinToken: roll.spinToken });
  assert.equal(replay.status, 409);
  assert.equal(stockOf('blister-bts-x5pcs'), 2);
});

test('si otro comprador agota el stock antes de aceptar, devuelve 409 con rollback total', async () => {
  const roll = await rollSpinSession('estandar');
  const drawnIds = roll.prizes.map((p) => p.id);
  const depletedId = drawnIds[0];

  const initialOthers = new Map();
  for (const id of drawnIds) {
    if (id !== depletedId && !initialOthers.has(id)) {
      initialOthers.set(id, stockOf(id));
    }
  }

  // Otro cliente agota el primer premio antes de que este usuario acepte
  db._data.set(`stock/${depletedId}`, { Cantidad: 0 });

  const acceptRes = await post('/api/spin/accept', { spinToken: roll.spinToken });
  assert.equal(acceptRes.status, 409);

  // Ningún otro producto debe haberse descontado
  assert.equal(stockOf(depletedId), 0);
  for (const [id, qty] of initialOthers) {
    assert.equal(stockOf(id), qty);
  }
});

test('POST /api/stock/hold extiende holdUntil cuando se entrega reservationId y token válidos', async () => {
  const r = await reserveStock([{ id: '11-minas-bts', qty: 1 }], { holdMinutes: 5 });
  const initialHold = reservationOf(r.reservationId).holdUntil;

  const res = await post('/api/stock/hold', {
    reservations: [
      { reservationId: r.reservationId, token: r.token },
      { reservationId: r.reservationId, token: 'token-invalido-123456' },
    ],
  });
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.updated, 1);
  const newHold = reservationOf(r.reservationId).holdUntil;
  assert.ok(newHold > initialHold + 60 * 60_000);
});
