import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './helpers/fake-firestore.js';
import { __setDbForTests } from '../src/lib/firebase.js';
import { reserveStock, expireReservations, confirmReservation, releaseReservation } from '../src/lib/inventory.js';
import { app } from '../src/server.js';

let server;
let base;
let db;

const stockOf = (id) => db._data.get(`stock/${id}`)?.Cantidad;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
  db = createFakeFirestore({
    stock: { '11-minas-bts': { Cantidad: 3 }, 'atari-sapito': { Cantidad: 1 } },
  });
  __setDbForTests(db);
});

const post = (path, body) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('GET /api/catalog devuelve stock vivo y nunca expone el costo', async () => {
  const res = await fetch(`${base}/api/catalog`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const bts = body.productos.find((p) => p.id === '11-minas-bts');
  assert.equal(bts.stock, 3);
  assert.equal(bts.precio, 3000);
  assert.ok(body.productos.every((p) => !('costo' in p)));
  // productos sin documento en Firestore se muestran con 0 (no se sobrevende)
  assert.equal(body.productos.find((p) => p.id === 'borrador-aguacate').stock, 0);
});

test('reservar descuenta stock de forma atómica', async () => {
  const res = await post('/api/stock/reserve', { items: [{ id: '11-minas-bts', qty: 2 }] });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.reservationId && body.token);
  assert.equal(stockOf('11-minas-bts'), 1);
});

test('si un producto no alcanza, no se descuenta nada (rollback)', async () => {
  const res = await post('/api/stock/reserve', {
    items: [
      { id: '11-minas-bts', qty: 1 },
      { id: 'atari-sapito', qty: 2 },
    ],
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.details[0].id, 'atari-sapito');
  assert.equal(stockOf('11-minas-bts'), 3);
  assert.equal(stockOf('atari-sapito'), 1);
});

test('rechaza ítems inválidos', async () => {
  for (const items of [[], [{ id: 'no-existe', qty: 1 }], [{ id: '11-minas-bts', qty: 0 }], [{ id: '11-minas-bts', qty: 1.5 }], 'x']) {
    const res = await post('/api/stock/reserve', { items });
    assert.equal(res.status, 400, JSON.stringify(items));
  }
});

test('liberar exige el token correcto y devuelve el stock', async () => {
  const { reservationId, token } = await (await post('/api/stock/reserve', { items: [{ id: '11-minas-bts', qty: 3 }] })).json();
  assert.equal(stockOf('11-minas-bts'), 0);

  const bad = await post('/api/stock/release', { reservationId, token: 'token-falso-123456' });
  assert.equal(bad.status, 404);
  assert.equal(stockOf('11-minas-bts'), 0);

  const ok = await post('/api/stock/release', { reservationId, token });
  assert.equal(ok.status, 200);
  assert.equal(stockOf('11-minas-bts'), 3);

  // liberar dos veces no duplica stock (idempotente)
  await post('/api/stock/release', { reservationId, token });
  assert.equal(stockOf('11-minas-bts'), 3);
});

test('las reservas vencidas se liberan solas', async () => {
  await reserveStock([{ id: '11-minas-bts', qty: 2 }], { holdMinutes: -1 });
  assert.equal(stockOf('11-minas-bts'), 1);
  assert.equal(await expireReservations(), 1);
  assert.equal(stockOf('11-minas-bts'), 3);
});

test('una reserva confirmada (pagada) no devuelve stock al cancelarla', async () => {
  const r = await reserveStock([{ id: 'atari-sapito', qty: 1 }]);
  await confirmReservation(r.reservationId);
  const res = await releaseReservation(r.reservationId, r.token);
  assert.equal(res.changed, false);
  assert.equal(stockOf('atari-sapito'), 0);
  assert.equal(await expireReservations(), 0);
});

test('no se exponen archivos internos del proyecto', async () => {
  for (const path of ['/src/config.js', '/package.json', '/.env', '/node_modules/express/package.json', '/netlify.toml']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 404, path);
  }
  const inv = await (await fetch(`${base}/data/inventario.json`)).json();
  assert.ok(inv.productos.length > 0);
  assert.ok(inv.productos.every((p) => !('costo' in p)));
});

test('las páginas actuales siguen funcionando', async () => {
  for (const path of ['/', '/catalogo', '/catalogo.html', '/spin.html', '/assets/css/styles.css']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, path);
  }
});
