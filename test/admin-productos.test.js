import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { config } from '../src/config.js';
import { createFakeFirestore } from './helpers/fake-firestore.js';
import { __setDbForTests } from '../src/lib/firebase.js';
import { ensureCatalogSeeded, invalidateCatalogCache } from '../src/lib/catalog.js';
import { app } from '../src/server.js';

let server;
let base;
let db;
let prevAdmin;

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
    [config.firebase.stockCollection]: {
      '11-minas-bts': { Cantidad: 5 },
    },
  });
  __setDbForTests(db);
  invalidateCatalogCache();
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
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  const page = await fetch(`${base}/admin/productos`, { headers: { cookie } });
  assert.equal(page.status, 200);
  const html = await page.text();
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
  assert.ok(match && match[1]);
  return { cookie, csrf: match[1] };
}

test('ensureCatalogSeeded siembra Firestore una sola vez de forma idempotente', async () => {
  const first = await ensureCatalogSeeded();
  assert.equal(first.alreadySeeded, false);
  assert.ok(first.seeded > 0);

  const second = await ensureCatalogSeeded();
  assert.equal(second.alreadySeeded, true);
  assert.equal(second.seeded, 0);
});

test('CRUD completo de producto con subida de imagen WebP en Firestore y filtro por visibilidad', async () => {
  const { cookie, csrf } = await loginAsAdmin();

  const pngBuffer = await sharp({
    create: {
      width: 40,
      height: 40,
      channels: 3,
      background: { r: 107, g: 63, b: 160 },
    },
  })
    .png()
    .toBuffer();

  // CSRF inválido en multipart debe bloquearse con 403
  const badFd = new FormData();
  badFd.append('_csrf', 'token-falso');
  badFd.append('nombre', 'Producto Bloqueado');
  badFd.append('foto', new Blob([pngBuffer], { type: 'image/png' }), 'test.png');
  const blocked = await fetch(`${base}/admin/productos/nuevo`, {
    method: 'POST',
    headers: { cookie },
    body: badFd,
  });
  assert.equal(blocked.status, 403);

  // Creación legítima con imagen
  const fd = new FormData();
  fd.append('_csrf', csrf);
  fd.append('nombre', 'Lámpara Nebulosa Nova');
  fd.append('categoria', 'Edición Galaxia');
  fd.append('precio_referencia', '45000');
  fd.append('costo', '21000');
  fd.append('stock', '7');
  fd.append('peso_spin', '15');
  fd.append('catalogo', 'on');
  fd.append('activo', 'on');
  fd.append('foto', new Blob([pngBuffer], { type: 'image/png' }), 'nova.png');

  const createRes = await fetch(`${base}/admin/productos/nuevo`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie },
    body: fd,
  });
  assert.equal(createRes.status, 302);

  // Verificar catálogo público y ausencia de costo
  const apiRes = await fetch(`${base}/api/catalog`);
  assert.equal(apiRes.status, 200);
  const catalogJson = await apiRes.json();
  const created = catalogJson.productos.find((p) => p.id === 'lampara-nebulosa-nova');
  assert.ok(created, 'El nuevo producto debe aparecer en /api/catalog');
  assert.equal(created.precio, 45000);
  assert.equal(created.stock, 7);
  assert.equal('costo' in created, false, 'Nunca exponer costo al público');
  assert.match(created.imagen, /^\/media\/[a-f0-9]{16}\.webp$/);

  // Verificar servicio de imagen WebP desde /media/:id.webp
  const imgRes = await fetch(`${base}${created.imagen}`);
  assert.equal(imgRes.status, 200);
  assert.equal(imgRes.headers.get('content-type'), 'image/webp');
  assert.match(imgRes.headers.get('cache-control') || '', /immutable/);
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
  assert.equal(imgBuf.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(imgBuf.subarray(8, 12).toString('ascii'), 'WEBP');

  // Verificar categoría dinámica en /catalogo SSR
  const ssrRes = await fetch(`${base}/catalogo`);
  assert.equal(ssrRes.status, 200);
  const ssrHtml = await ssrRes.text();
  assert.ok(ssrHtml.includes('Edición Galaxia'));

  // Editar un producto existente con tilde en el ID preservando su ID original
  const editRes = await postForm(
    `/admin/productos/${encodeURIComponent('bolsa-térmica-250-ml')}`,
    {
      _csrf: csrf,
      nombre: 'Bolsa Térmica 250 ml Pro',
      categoria: 'Decoración',
      precio_referencia: '22000',
      costo: '10000',
      stock: '12',
      peso_spin: '10',
      catalogo: 'on',
      activo: 'on',
    },
    cookie,
  );
  assert.equal(editRes.status, 302);

  const afterEdit = await (await fetch(`${base}/api/catalog`)).json();
  const edited = afterEdit.productos.find((p) => p.id === 'bolsa-térmica-250-ml');
  assert.ok(edited);
  assert.equal(edited.nombre, 'Bolsa Térmica 250 ml Pro');
  assert.equal(edited.precio, 22000);
  assert.equal(edited.stock, 12);

  // Ocultar producto (toggle) y verificar que desaparece del catálogo público
  const hideRes = await postForm('/admin/productos/lampara-nebulosa-nova/toggle', { _csrf: csrf }, cookie);
  assert.equal(hideRes.status, 302);

  const afterHide = await (await fetch(`${base}/api/catalog`)).json();
  assert.equal(
    afterHide.productos.some((p) => p.id === 'lampara-nebulosa-nova'),
    false,
    'Producto oculto no debe aparecer en /api/catalog',
  );
});

test('Carga masiva CSV (punto y coma) y JSON crea/actualiza productos y registra Kardex', async () => {
  const { cookie, csrf } = await loginAsAdmin();

  // Exportar CSV compatible con Excel
  const csvExport = await fetch(`${base}/admin/productos/plantilla.csv`, { headers: { cookie } });
  assert.equal(csvExport.status, 200);
  const csvText = await csvExport.text();
  assert.ok(csvText.includes('precio_referencia'));

  // Importar archivo CSV con punto y coma
  const customCsv =
    '\uFEFFid;nombre;categoria;precio_referencia;costo;stock;catalogo;spin_estandar;spin_premium;peso_spin;activo\r\n' +
    'pin-astro-csv;Pin Astronauta CSV;Accesorios;15000;6500;18;si;no;no;8;si\r\n' +
    'atari-sapito;Atari Retro Sapito;Figuras;19500;9000;9;si;si;no;12;si\r\n';

  const csvFd = new FormData();
  csvFd.append('_csrf', csrf);
  csvFd.append('overwrite', 'on');
  csvFd.append('updateStock', 'on');
  csvFd.append('archivo', new Blob([customCsv], { type: 'text/csv' }), 'lote.csv');

  const csvRes = await fetch(`${base}/admin/productos/importar`, {
    method: 'POST',
    headers: { cookie },
    body: csvFd,
  });
  assert.equal(csvRes.status, 200);
  const csvHtml = await csvRes.text();
  assert.ok(csvHtml.includes('Carga masiva completada'));
  assert.ok(csvHtml.includes('1 creados'));
  assert.ok(csvHtml.includes('1 actualizados'));

  // Importar JSON
  const jsonPayload = JSON.stringify({
    productos: [
      {
        id: 'cuaderno-constelacion-json',
        nombre: 'Cuaderno Constelación JSON',
        categoria: 'Papelería',
        precio_referencia: 28000,
        costo: 14000,
        stock: 6,
        flags: { catalogo: true, spin_estandar: false, spin_premium: true },
        activo: true,
      },
    ],
  });
  const jsonFd = new FormData();
  jsonFd.append('_csrf', csrf);
  jsonFd.append('overwrite', 'on');
  jsonFd.append('updateStock', 'on');
  jsonFd.append('archivo', new Blob([jsonPayload], { type: 'application/json' }), 'lote.json');

  const jsonRes = await fetch(`${base}/admin/productos/importar`, {
    method: 'POST',
    headers: { cookie },
    body: jsonFd,
  });
  assert.equal(jsonRes.status, 200);

  // Ajuste manual de stock + nota Kardex en /admin/inventario
  const invRes = await postForm(
    '/admin/inventario/pin-astro-csv/stock',
    { _csrf: csrf, stock: '24', note: 'Reposición proveedor' },
    cookie,
  );
  assert.equal(invRes.status, 302);

  const invPage = await fetch(`${base}/admin/inventario`, { headers: { cookie } });
  const invHtml = await invPage.text();
  assert.ok(invHtml.includes('Pin Astronauta CSV'));
  assert.ok(invHtml.includes('Reposición proveedor'));
  assert.ok(invHtml.includes('+6'));

  // Confirmar catálogo público con productos creados por CSV y JSON
  const apiCat = await (await fetch(`${base}/api/catalog`)).json();
  assert.ok(apiCat.productos.some((p) => p.id === 'pin-astro-csv' && p.stock === 24));
  assert.ok(apiCat.productos.some((p) => p.id === 'cuaderno-constelacion-json' && p.stock === 6));
});
