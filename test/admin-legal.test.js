import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createFakeFirestore } from './helpers/fake-firestore.js';
import { __setDbForTests } from '../src/lib/firebase.js';
import { createOrder } from '../src/lib/orders.js';
import { app } from '../src/server.js';

let server;
let base;
let db;
let prevAdmin;

const stockOf = (id) => db._data.get(`stock/${id}`)?.Cantidad;
const orderOf = (code) => db._data.get(`orders/${code}`);
const couponOf = (code) => db._data.get(`coupons/${code}`);
const settingsOf = () => db._data.get('settings/store');
const pqrsOf = (radicado) => db._data.get(`pqrs/${radicado}`);

before(async () => {
  prevAdmin = { email: config.adminEmail, password: config.adminPassword };
  config.adminEmail = 'jaidimportando@gmail.com';
  config.adminPassword = 'ClaveAdminPrueba2026!';

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  config.adminEmail = prevAdmin.email;
  config.adminPassword = prevAdmin.password;
  server.close();
});

beforeEach(() => {
  db = createFakeFirestore({
    stock: {
      '11-minas-bts': { Cantidad: 5 },
      'atari-sapito': { Cantidad: 4 },
    },
  });
  __setDbForTests(db);
});

const postForm = (path, params, cookie = '') =>
  fetch(base + path, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(params).toString(),
  });

async function loginAsAdmin() {
  const res = await postForm('/admin/login', {
    email: config.adminEmail,
    password: config.adminPassword,
  });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin');

  const setCookie = res.headers.get('set-cookie') || '';
  assert.ok(setCookie.includes('su_admin='));
  assert.ok(setCookie.includes('HttpOnly'));

  const cookie = setCookie.split(';')[0];
  const dash = await fetch(`${base}/admin`, { headers: { cookie } });
  assert.equal(dash.status, 200);
  const html = await dash.text();
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
  assert.ok(match && match[1], 'Debe incluir token CSRF en el HTML del panel');

  return { cookie, csrf: match[1], dashHtml: html };
}

test('Footer y rutas legales cumplen con SIC, Ley 1480/2439, Ley 1581/2300 y Decreto 587/2016', async () => {
  const homeRes = await fetch(`${base}/`);
  assert.equal(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.ok(homeHtml.includes('/terminos-y-condiciones'));
  assert.ok(homeHtml.includes('/politica-de-privacidad'));
  assert.ok(homeHtml.includes('/reversion-de-pago'));
  assert.ok(homeHtml.includes('https://www.sic.gov.co'));
  assert.ok(homeHtml.includes('id="btn-admin-secret"'));
  assert.ok(homeHtml.includes('id="admin-secret-modal"'));
  assert.ok(homeHtml.includes('id="cookie-banner"'));
  assert.ok(homeHtml.includes('jaidimportando@gmail.com'));
  assert.ok(homeHtml.includes('/assets/img/perfil/2.webp'));

  const termsRes = await fetch(`${base}/terminos-y-condiciones`);
  assert.equal(termsRes.status, 200);
  const termsHtml = await termsRes.text();
  assert.ok(termsHtml.includes('Ley 1480 de 2011'));
  assert.ok(termsHtml.includes('Ley 2439 de 2024'));
  assert.ok(termsHtml.includes('quince (15) días calendario'));

  const privRes = await fetch(`${base}/politica-de-privacidad`);
  assert.equal(privRes.status, 200);
  const privHtml = await privRes.text();
  assert.ok(privHtml.includes('Ley Estatutaria 1581 de 2012'));
  assert.ok(privHtml.includes('Ley 2300 de 2023'));

  const revRes = await fetch(`${base}/reversion-de-pago`);
  assert.equal(revRes.status, 200);
  const revHtml = await revRes.text();
  assert.ok(revHtml.includes('Decreto 587 de 2016'));

  const pqrsRes = await fetch(`${base}/api/pqrs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'reversion',
      orderCode: 'SU-12345',
      name: 'Carlos Ruiz',
      email: 'carlos@ejemplo.com',
      phone: '3101234567',
      document: '1020304050',
      reason: 'Producto defectuoso',
      details: 'Llegó roto en el envío.',
    }),
  });
  assert.equal(pqrsRes.status, 201);
  const pqrsBody = await pqrsRes.json();
  assert.ok(pqrsBody.claim.radicado.startsWith('PQRS-'));
  assert.equal(pqrsOf(pqrsBody.claim.radicado).status, 'radicado');
});

test('Autenticación admin, protección CSRF, barra flotante y campañas/cupones/stock', async () => {
  // Sin sesión redirige a /admin/login
  const anon = await fetch(`${base}/admin`, { redirect: 'manual' });
  assert.equal(anon.status, 302);
  assert.equal(anon.headers.get('location'), '/admin/login');

  // Contraseña incorrecta devuelve 401
  const badLogin = await postForm('/admin/login', {
    email: config.adminEmail,
    password: 'clave-incorrecta',
  });
  assert.equal(badLogin.status, 401);

  // Login válido con espacios accidentales en la contraseña entrega cookie y sesión
  const paddedLogin = await postForm('/admin/login', {
    email: 'jaidimportando@gmail.com',
    password: `  ${config.adminPassword}  `,
  });
  assert.equal(paddedLogin.status, 302);
  assert.equal(paddedLogin.headers.get('location'), '/admin');

  // Login válido entrega cookie y sesión
  const { cookie, csrf, dashHtml } = await loginAsAdmin();
  assert.ok(dashHtml.includes('Resumen del Negocio'));

  // En la tienda pública aparece la barra flotante exclusiva del admin
  const publicWithAdmin = await fetch(`${base}/`, { headers: { cookie } });
  const publicHtml = await publicWithAdmin.text();
  assert.ok(publicHtml.includes('id="admin-floating-bar"'));

  // Sin CSRF -> 403
  const noCsrf = await postForm(
    '/admin/campanas/flash',
    { active: 'on', percent: '15', title: 'Sin CSRF' },
    cookie,
  );
  assert.equal(noCsrf.status, 403);

  // Activar Evento Flash con CSRF válido
  const flashRes = await postForm(
    '/admin/campanas/flash',
    { _csrf: csrf, active: 'on', percent: '15', title: 'Flash Galáctico' },
    cookie,
  );
  assert.equal(flashRes.status, 302);
  assert.equal(settingsOf().flashSale.active, true);
  assert.equal(settingsOf().flashSale.percent, 15);
  assert.equal(settingsOf().flashSale.title, 'Flash Galáctico');

  // Crear cupón limitado PRIMEROS15 con CSRF válido
  const cupRes = await postForm(
    '/admin/campanas/cupones',
    {
      _csrf: csrf,
      code: 'PRIMEROS15',
      type: 'percent',
      value: '15',
      maxUses: '15',
      minSubtotal: '0',
    },
    cookie,
  );
  assert.equal(cupRes.status, 302);
  assert.equal(couponOf('PRIMEROS15').maxUses, 15);
  assert.equal(couponOf('PRIMEROS15').active, true);

  // Actualizar stock de un producto desde inventario admin
  const stockRes = await postForm(
    '/admin/inventario/11-minas-bts/stock',
    { _csrf: csrf, stock: '25' },
    cookie,
  );
  assert.equal(stockRes.status, 302);
  assert.equal(stockOf('11-minas-bts'), 25);
});

test('Ciclo logístico completo de pedido desde admin: pagado -> enviado con guía -> entregado', async () => {
  const { cookie, csrf } = await loginAsAdmin();

  const order = await createOrder({
    paymentMethod: 'manual',
    customer: {
      name: 'Sofía Martínez',
      email: 'sofia@ejemplo.com',
      phone: '3019876543',
      document: '1030405060',
      department: 'Antioquia',
      city: 'Medellín',
      address: 'Carrera 43A # 10-50',
      acceptTerms: true,
    },
    items: [{ tipo: 'producto', id: 'atari-sapito', qty: 1, origen: 'catalogo' }],
  });
  assert.equal(order.status, 'pendiente');

  const paidRes = await postForm(
    `/admin/pedidos/${order.code}/pagado`,
    { _csrf: csrf, paymentRef: 'NEQUI-4455' },
    cookie,
  );
  assert.equal(paidRes.status, 302);
  assert.equal(orderOf(order.code).status, 'pagado');
  assert.equal(orderOf(order.code).paymentRef, 'NEQUI-4455');

  const shipRes = await postForm(
    `/admin/pedidos/${order.code}/enviar`,
    { _csrf: csrf, tracking: 'SERVI-998877' },
    cookie,
  );
  assert.equal(shipRes.status, 302);
  assert.equal(orderOf(order.code).status, 'enviado');
  assert.equal(orderOf(order.code).tracking, 'SERVI-998877');

  const delivRes = await postForm(
    `/admin/pedidos/${order.code}/entregado`,
    { _csrf: csrf },
    cookie,
  );
  assert.equal(delivRes.status, 302);
  assert.equal(orderOf(order.code).status, 'entregado');
});
