import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { config } from '../src/config.js';
import { createFakeFirestore } from './helpers/fake-firestore.js';
import { __setDbForTests } from '../src/lib/firebase.js';
import { invalidateCatalogCache } from '../src/lib/catalog.js';
import { saveMediaToFirestore } from '../src/lib/images.js';
import { handler } from '../netlify/functions/api.mjs';

let db;

beforeEach(() => {
  db = createFakeFirestore({
    stock: {
      'atari-sapito': { Cantidad: 4 },
    },
  });
  __setDbForTests(db);
  invalidateCatalogCache();
});

function invokeNetlify({ path, rawUrl, method = 'GET', headers = {} }) {
  return handler(
    {
      httpMethod: method,
      path,
      rawUrl,
      headers: { host: 'shopuniverses.netlify.app', ...headers },
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      body: null,
      isBase64Encoded: false,
      requestContext: { identity: { sourceIp: '127.0.0.1' } },
    },
    {},
  );
}

test('Netlify handler resuelve /api/catalog aunque event.path incluya /.netlify/functions/api', async () => {
  const res = await invokeNetlify({
    path: '/.netlify/functions/api/catalog',
    rawUrl: 'https://shopuniverses.netlify.app/api/catalog',
  });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body.productos) && body.productos.length > 0);
  assert.equal('costo' in body.productos[0], false);
});

test('Netlify handler renderiza vistas EJS SSR (/catalogo) y sirve imágenes WebP en base64', async () => {
  const ssrRes = await invokeNetlify({
    path: '/catalogo',
    rawUrl: 'https://shopuniverses.netlify.app/catalogo',
  });
  assert.equal(ssrRes.statusCode, 200);
  assert.ok(ssrRes.body.includes('Catálogo ShopUniverses'));

  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 61, g: 214, b: 208 } },
  })
    .png()
    .toBuffer();
  const saved = await saveMediaToFirestore(png);

  const imgRes = await invokeNetlify({
    path: saved.url,
    rawUrl: `https://shopuniverses.netlify.app${saved.url}`,
  });
  assert.equal(imgRes.statusCode, 200);
  assert.equal(imgRes.isBase64Encoded, true);
  assert.equal(imgRes.headers['content-type'], 'image/webp');
  const buf = Buffer.from(imgRes.body, 'base64');
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP');
});
