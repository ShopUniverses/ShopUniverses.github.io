// ========================================================
// SERVER.JS — Punto de Entrada y Configuración de Express
// ========================================================
import express from 'express';
import ejs from 'ejs';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { fmtCOP, fmtDate } from './lib/util.js';
import { legacyPublicCatalog, ensureCatalogSeeded } from './lib/catalog.js';
import { loadAdmin, ensureAdminFromEnv } from './lib/auth.js';
import apiRoutes from './routes/api.js';
import adminRoutes from './routes/admin.js';
import storeRoutes from './routes/store.js';

export const app = express();
app.disable('x-powered-by');

if (config.behindProxy) {
  app.set('trust proxy', 1);
}

// Motor de vistas EJS (registro explícito compatible con bundling esbuild)
app.engine('ejs', ejs.__express);
app.set('view engine', 'ejs');
app.set('views', path.join(config.root, 'src', 'views'));

// Cabeceras de seguridad
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://checkout.wompi.co'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'https:', 'blob:'],
        'connect-src': ["'self'", 'https://checkout.wompi.co'],
        'frame-src': ['https://checkout.wompi.co'],
        'form-action': ["'self'", 'https://checkout.wompi.co'],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'upgrade-insecure-requests': null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.json({ limit: '150kb' }));
app.use(express.urlencoded({ extended: false, limit: '150kb' }));

// Variables accesibles en todas las vistas EJS
app.use((req, res, next) => {
  res.locals.store = config.store;
  res.locals.flashSale = null;
  res.locals.storeSettings = null;
  res.locals.admin = null;
  res.locals.csrf = '';
  res.locals.fmtCOP = fmtCOP;
  res.locals.fmtDate = fmtDate;
  res.locals.currentPath = req.path;
  next();
});
app.use(loadAdmin);

// ---------------- API ----------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', store: config.store.name, version: '2.0.0', timestamp: new Date().toISOString() });
});
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// ---------------- Archivos estáticos (solo lista blanca) ----------------
// IMPORTANTE: nunca servir la raíz completa del proyecto (expondría src/, package.json,
// node_modules/ y el costo de los productos en data/inventario.json).
const maxAge = config.isProd ? '1d' : 0;
app.use('/assets', express.static(path.join(config.root, 'assets'), { maxAge, dotfiles: 'deny' }));

// Compatibilidad con el frontend actual: inventario SIN costos.
app.get('/data/inventario.json', (req, res) => {
  res.set('Cache-Control', 'no-store').json(legacyPublicCatalog());
});

// ---------------- Vistas SSR ----------------
app.use('/', storeRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('notfound', { title: 'Página no encontrada', activeNav: '' });
});

// Inicio del servidor solo si este archivo se ejecuta directamente (no en Netlify ni en tests)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  await ensureAdminFromEnv();
  await ensureCatalogSeeded();
  app.listen(config.port, config.host, () => {
    const baseUrl = `http://${config.host}:${config.port}`;
    console.log(`\n  Tienda ${config.store.name} lista en: ${baseUrl}`);
    console.log(`  Panel administrativo:        ${baseUrl}/admin`);
    console.log(`  Usuario admin configurado:   ${config.adminEmail}`);
    if (!config.isProd && config.adminPassword) {
      console.log(`  Clave inicial (.env):        ${config.adminPassword} (o la configurada en Firestore)`);
    }
    console.log('  (Para cambiar credenciales: npm run create-admin -- correo "nueva-clave")\n');
  });
}
