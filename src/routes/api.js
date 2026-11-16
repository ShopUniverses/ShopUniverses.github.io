// ========================================================
// ROUTES/API.JS — API pública de catálogo y stock
// ========================================================
import { Router } from 'express';
import { loadCatalog, toPublicProduct } from '../lib/catalog.js';
import { getStockMap, reserveStock, releaseReservation, sweepExpiredIfDue } from '../lib/inventory.js';
import { apiLimiter, stockLimiter, asyncHandler, apiErrorHandler } from '../lib/http.js';

const router = Router();
router.use(apiLimiter);

// Respuestas de la API nunca se cachean en el navegador/CDN (stock vivo)
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/** GET /api/catalog — productos públicos con stock vivo (sin costos). */
router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    await sweepExpiredIfDue();
    const { config: cfg, productos } = loadCatalog();
    const stock = await getStockMap();
    res.json({
      config: { spin: cfg.spin },
      productos: productos.map((p) => toPublicProduct(p, stock[p.id])),
    });
  }),
);

/** GET /api/stock — solo el mapa de stock { id: cantidad } (para refrescos ligeros). */
router.get(
  '/stock',
  asyncHandler(async (req, res) => {
    await sweepExpiredIfDue();
    res.json({ stock: await getStockMap() });
  }),
);

/** POST /api/stock/reserve — body: { items: [{ id, qty }] } */
router.post(
  '/stock/reserve',
  stockLimiter,
  asyncHandler(async (req, res) => {
    await sweepExpiredIfDue();
    const result = await reserveStock(req.body?.items, { source: 'catalogo' });
    res.status(201).json(result);
  }),
);

/** POST /api/stock/release — body: { reservationId, token } */
router.post(
  '/stock/release',
  stockLimiter,
  asyncHandler(async (req, res) => {
    const { reservationId, token } = req.body || {};
    const result = await releaseReservation(reservationId, token);
    res.json(result);
  }),
);

router.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
router.use(apiErrorHandler);

export default router;
