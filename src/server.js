// ========================================================
// SERVER.JS — Punto de Entrada y Configuración de Express
// ========================================================
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { config } from './config.js';
import { fmtCOP, fmtDate } from './lib/util.js';

export const app = express();
app.disable('x-powered-by');

if (config.behindProxy) {
  app.set('trust proxy', 1);
}

// Configuración de motor de vistas EJS (para panel admin y vistas SSR)
app.set('view engine', 'ejs');
app.set('views', path.join(config.root, 'src', 'views'));

// Seguridad con Helmet (permitiendo fuentes y CDN de imágenes)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", 'https://checkout.wompi.co', 'https://www.gstatic.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'https:', 'blob:'],
        'connect-src': ["'self'", 'https://checkout.wompi.co', 'https://firestore.googleapis.com'],
        'form-action': ["'self'", 'https://checkout.wompi.co'],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'upgrade-insecure-requests': null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// Parsers JSON y formularios
app.use(express.json({ limit: '150kb' }));
app.use(express.urlencoded({ extended: false, limit: '150kb' }));

// Servir archivos estáticos del sitio actual (compatibilidad con estructura existente)
app.use('/assets', express.static(path.join(config.root, 'assets'), { maxAge: config.isProd ? '1d' : 0 }));
app.use('/data', express.static(path.join(config.root, 'data'), { maxAge: 0 }));
app.use(express.static(config.root, { 
  index: ['index.html'],
  extensions: ['html'],
  maxAge: config.isProd ? '1h' : 0 
}));

// Variables accesibles en todas las vistas EJS
app.use((req, res, next) => {
  res.locals.store = config.store;
  res.locals.fmtCOP = fmtCOP;
  res.locals.fmtDate = fmtDate;
  res.locals.currentPath = req.path;
  next();
});

// Ruta de comprobación de salud del sistema
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    store: config.store.name,
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

import { fileURLToPath } from 'node:url';

// Inicio del servidor solo si este archivo se ejecuta directamente
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  app.listen(config.port, config.host, () => {
    console.log(`🚀 Servidor ShopUniverses corriendo en: http://${config.host}:${config.port}`);
  });
}
