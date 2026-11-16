// ========================================================
// SERVER.JS — Punto de Entrada y Configuración de Express
// ========================================================
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { fmtCOP, fmtDate } from './lib/util.js';
import { legacyPublicCatalog } from './lib/catalog.js';
import apiRoutes from './routes/api.js';

export const app = express();
app.disable('x-powered-by');

if (config.behindProxy) {
  app.set('trust proxy', 1);
}

// Motor de vistas EJS (panel admin y vistas SSR en fases siguientes)
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
  res.locals.fmtCOP = fmtCOP;
  res.locals.fmtDate = fmtDate;
  res.locals.currentPath = req.path;
  next();
});

// ---------------- API ----------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', store: config.store.name, version: '2.0.0', timestamp: new Date().toISOString() });
});
app.use('/api', apiRoutes);

// ---------------- Archivos estáticos (solo lista blanca) ----------------
// IMPORTANTE: nunca servir la raíz completa del proyecto (expondría src/, package.json,
// node_modules/ y el costo de los productos en data/inventario.json).
const maxAge = config.isProd ? '1d' : 0;
app.use('/assets', express.static(path.join(config.root, 'assets'), { maxAge, dotfiles: 'deny' }));

// Compatibilidad con el frontend actual: inventario SIN costos.
app.get('/data/inventario.json', (req, res) => {
  res.set('Cache-Control', 'no-store').json(legacyPublicCatalog());
});

const PAGES = new Set(
  fs.readdirSync(config.root).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')),
);
app.get(['/', '/:page'], (req, res, next) => {
  const page = (req.params.page || 'index').replace(/\.html$/, '');
  if (!PAGES.has(page)) return next();
  res.sendFile(path.join(config.root, `${page}.html`), { maxAge: config.isProd ? '1h' : 0 });
});

// 404
app.use((req, res) => {
  const notFound = path.join(config.root, '404.html');
  if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
  res.status(404).send('Página no encontrada');
});

// Inicio del servidor solo si este archivo se ejecuta directamente (no en Netlify ni en tests)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  app.listen(config.port, config.host, () => {
    console.log(`🚀 Servidor ShopUniverses corriendo en: http://${config.host}:${config.port}`);
  });
}
