// ========================================================
// CONFIG.JS — Configuración Central del Sistema
// ========================================================
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveRoot() {
  const metaUrl = typeof import.meta !== 'undefined' ? import.meta.url : '';
  const here = metaUrl ? path.dirname(fileURLToPath(metaUrl)) : process.cwd();
  const candidates = [
    path.resolve(here, '..'),
    path.resolve(here, '..', '..'),
    process.cwd(),
    '/var/task',
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'src', 'views')) && fs.existsSync(path.join(dir, 'data', 'inventario.json'))) {
      return dir;
    }
  }
  return path.resolve(here, '..');
}

function normalizePem(raw = '') {
  const cleaned = String(raw || '').trim().replace(/^["']|["']$/g, '');
  return cleaned ? cleaned.replace(/\\n/g, '\n') : '';
}

const root = resolveRoot();
const env = process.env;
const port = Number(env.PORT || 3000);
const isNetlifyRuntime = Boolean(env.NETLIFY) && env.NETLIFY_DEV !== 'true';
const inferredSiteUrl = env.SITE_URL || env.URL || env.DEPLOY_PRIME_URL || `http://localhost:${port}`;

export const config = {
  root,
  port,
  host: env.HOST || '127.0.0.1',
  siteUrl: inferredSiteUrl.replace(/\/$/, ''),
  isProd: env.NODE_ENV === 'production' || isNetlifyRuntime,
  behindProxy: env.BEHIND_PROXY === '1' || env.NODE_ENV === 'production' || Boolean(env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME),
  sessionSecret: env.SESSION_SECRET || 'dev_secret_key_shopuniverses_2026',
  
  // Administrador inicial (configurar ADMIN_PASSWORD en .env o Netlify)
  adminEmail: (env.ADMIN_EMAIL || 'jaidimportando@gmail.com').trim().toLowerCase(),
  adminPassword: (env.ADMIN_PASSWORD || '').trim(),

  // Google Firebase
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID || 'shopuniverses-inventario',
    clientEmail: (env.FIREBASE_CLIENT_EMAIL || '').trim(),
    privateKey: normalizePem(env.FIREBASE_PRIVATE_KEY),
    serviceAccountPath: env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  },

  // Pasarela Wompi
  wompi: {
    env: (env.WOMPI_ENV || 'sandbox').toLowerCase(),
    publicKey: env.WOMPI_PUBLIC_KEY || '',
    privateKey: env.WOMPI_PRIVATE_KEY || '',
    integritySecret: env.WOMPI_INTEGRITY_SECRET || '',
    eventsSecret: env.WOMPI_EVENTS_SECRET || '',
  },

  // Información Legal del Comercio (Colombia)
  store: {
    name: env.STORE_NAME || 'ShopUniverses',
    nit: env.STORE_NIT || '',
    city: env.STORE_CITY || 'Bogotá D.C.',
    address: env.STORE_ADDRESS || 'Colombia',
    phone: env.STORE_PHONE || '573001234567',
    email: env.STORE_EMAIL || 'jaidimportando@gmail.com',
    whatsapp: env.WHATSAPP_NUMBER || '573001234567',
    shippingFlat: Number(env.SHIPPING_FLAT || 12000),
    freeShippingMin: Number(env.FREE_SHIPPING_MIN || 100000),
    holdMinutes: Number(env.HOLD_MINUTES || 15),
    cartHoldMinutes: Number(env.CART_HOLD_MINUTES || 30),
    whatsappHoldHours: Number(env.WHATSAPP_HOLD_HOURS || 48),
  },

  // Firma de sesiones de ruleta (HMAC). En producción DEBE definirse.
  spinSecret: env.SPIN_SECRET || env.SESSION_SECRET || 'dev_spin_secret_shopuniverses_2026',

  dataDir: path.resolve(root, 'data'),
  publicDir: path.resolve(root, 'public'),
};

config.uploadsDir = path.join(config.dataDir, 'uploads');
