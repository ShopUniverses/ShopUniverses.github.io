// ========================================================
// CONFIG.JS — Configuración Central del Sistema
// ========================================================
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;
const port = Number(env.PORT || 3000);

export const config = {
  root,
  port,
  host: env.HOST || '127.0.0.1',
  siteUrl: (env.SITE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  isProd: env.NODE_ENV === 'production',
  behindProxy: env.BEHIND_PROXY === '1' || env.NODE_ENV === 'production',
  sessionSecret: env.SESSION_SECRET || 'dev_secret_key_shopuniverses_2026',
  
  // Administrador inicial
  adminEmail: (env.ADMIN_EMAIL || 'admin@shopuniverses.com').trim().toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD || 'CambiarEstaClaveSegura2026!',

  // Google Firebase
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID || 'shopuniverses-inventario',
    clientEmail: env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
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
    nit: env.STORE_NIT || 'Pendiente NIT',
    city: env.STORE_CITY || 'Bogotá D.C.',
    address: env.STORE_ADDRESS || 'Colombia',
    phone: env.STORE_PHONE || '573001234567',
    email: env.STORE_EMAIL || 'contacto@shopuniverses.com',
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
