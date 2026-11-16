import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import { config } from '../src/config.js';
import { listCategories } from '../src/lib/catalog.js';
import { optimizeImageBuffer } from '../src/lib/images.js';
import { app } from '../src/server.js';

let server;
let base;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('no existen archivos .html sueltos en la raíz del proyecto', () => {
  const htmlFiles = fs.readdirSync(config.root).filter((f) => f.endsWith('.html'));
  assert.deepEqual(htmlFiles, []);
});

test('GET /, /catalogo, /spin y /carrito devuelven 200 con HTML renderizado por EJS y categorías en /catalogo', async () => {
  const routes = [
    { path: '/', text: 'SHOPUNIVERSES' },
    { path: '/catalogo', text: 'Catálogo ShopUniverses' },
    { path: '/spin', text: 'Roulette of the Universe' },
    { path: '/carrito', text: 'TU CARRITO' },
  ];

  for (const r of routes) {
    const res = await fetch(base + r.path);
    assert.equal(res.status, 200, r.path);
    const html = await res.text();
    assert.ok(html.includes(r.text), `${r.path} debe incluir "${r.text}"`);
    assert.ok(html.includes('<!DOCTYPE html>'), `${r.path} debe devolver documento HTML completo`);
  }

  const catRes = await fetch(`${base}/catalogo`);
  const catHtml = await catRes.text();
  const categories = listCategories();
  assert.ok(categories.length > 0);
  for (const cat of categories) {
    assert.ok(catHtml.includes(`data-categoria="${cat}"`), `Falta botón de categoría: ${cat}`);
  }
});

test('GET /catalogo.html y /spin.html redirigen con 301 hacia /catalogo y /spin', async () => {
  const catRedir = await fetch(`${base}/catalogo.html`, { redirect: 'manual' });
  assert.equal(catRedir.status, 301);
  assert.equal(catRedir.headers.get('location'), '/catalogo');

  const spinRedir = await fetch(`${base}/spin.html`, { redirect: 'manual' });
  assert.equal(spinRedir.status, 301);
  assert.equal(spinRedir.headers.get('location'), '/spin');
});

test('ruta inexistente responde 404 renderizando la vista notfound.ejs de ShopUniverses', async () => {
  const res = await fetch(`${base}/no-existe`);
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.ok(html.includes('Coordenada fuera de órbita'));
  assert.ok(html.includes('ShopUniverses'));
});

test('optimizeImageBuffer procesa una imagen de prueba y devuelve un WebP válido', async () => {
  const pngBuffer = await sharp({
    create: {
      width: 900,
      height: 900,
      channels: 3,
      background: { r: 107, g: 63, b: 160 },
    },
  })
    .png()
    .toBuffer();

  const webp = await optimizeImageBuffer(pngBuffer, { width: 640, quality: 80 });
  assert.ok(Buffer.isBuffer(webp) && webp.length > 0);
  assert.equal(webp.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(webp.subarray(8, 12).toString('ascii'), 'WEBP');

  const meta = await sharp(webp).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 640);
});
