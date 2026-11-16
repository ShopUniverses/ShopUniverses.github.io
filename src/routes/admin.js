// ========================================================
// ROUTES/ADMIN.JS — Panel Administrativo Seguro (/admin)
// ========================================================
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loadCatalog } from '../lib/catalog.js';
import { getStockMap, setProductStock } from '../lib/inventory.js';
import {
  getStoreSettings,
  updateStoreSettings,
  saveCoupon,
  listCoupons,
  toggleCouponActive,
} from '../lib/promotions.js';
import {
  listOrders,
  getOrderByCode,
  markOrderPaid,
  markOrderShipped,
  markOrderDelivered,
  cancelOrder,
} from '../lib/orders.js';
import {
  loadAdmin,
  requireAdmin,
  checkCsrf,
  verifyAdminCredentials,
  changeAdminPassword,
  startAdminSession,
  clearAdminSession,
} from '../lib/auth.js';
import { asyncHandler } from '../lib/http.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).render('admin/login', {
      title: 'Acceso Administrativo',
      error: 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.',
    }),
});

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(loadAdmin);

// ---------------- Autenticación ----------------
router.get('/login', (req, res) => {
  if (req.admin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Acceso Administrativo', error: null });
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const admin = await verifyAdminCredentials(req.body?.email, req.body?.password);
    if (!admin) {
      return res.status(401).render('admin/login', {
        title: 'Acceso Administrativo',
        error: 'Credenciales inválidas.',
      });
    }
    startAdminSession(res, admin.email);
    res.redirect('/admin');
  }),
);

router.post('/salir', (req, res) => {
  clearAdminSession(res);
  res.redirect('/');
});

// Todo lo que sigue requiere sesión de administrador y token CSRF en POST
router.use(requireAdmin);
router.use((req, res, next) => {
  if (req.method === 'POST') return checkCsrf(req, res, next);
  next();
});

// ---------------- Dashboard ----------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [orders, stockMap, settings] = await Promise.all([
      listOrders(),
      getStockMap(),
      getStoreSettings(),
    ]);
    const catalog = loadCatalog();

    const paidStatuses = new Set(['pagado', 'enviado', 'entregado']);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    const thirtyDaysMs = Date.now() - 30 * 24 * 60 * 60_000;

    const today = { total: 0, n: 0 };
    const sales30d = { total: 0, n: 0 };
    const counts = { pendiente: 0, pagado: 0, enviado: 0, entregado: 0, cancelado: 0 };

    for (const o of orders) {
      if (o.status in counts) counts[o.status]++;
      if (paidStatuses.has(o.status)) {
        const ts = Date.parse(o.paidAt || o.createdAt || '') || 0;
        const val = Number(o.total) || 0;
        if (ts >= todayMs) {
          today.total += val;
          today.n++;
        }
        if (ts >= thirtyDaysMs) {
          sales30d.total += val;
          sales30d.n++;
        }
      }
    }

    const lowStock = catalog.productos
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        stock: Number.isFinite(stockMap[p.id]) ? stockMap[p.id] : 0,
      }))
      .filter((p) => p.stock <= 2)
      .sort((a, b) => a.stock - b.stock);

    res.render('admin/dashboard', {
      title: 'Resumen',
      today,
      sales30d,
      counts,
      lowStock,
      recent: orders.slice(0, 8),
      settings,
    });
  }),
);

// ---------------- Pedidos ----------------
router.get(
  '/pedidos',
  asyncHandler(async (req, res) => {
    const status = String(req.query.estado || '').trim().toLowerCase();
    const orders = await listOrders({ status });
    res.render('admin/orders', { title: 'Pedidos', orders, activeStatus: status });
  }),
);

router.get(
  '/pedidos/:code',
  asyncHandler(async (req, res, next) => {
    const order = await getOrderByCode(req.params.code);
    if (!order) return next();
    res.render('admin/order', { title: `Pedido ${order.code}`, order });
  }),
);

router.post(
  '/pedidos/:code/pagado',
  asyncHandler(async (req, res) => {
    const order = await markOrderPaid(req.params.code, { paymentRef: req.body?.paymentRef });
    res.redirect(`/admin/pedidos/${encodeURIComponent(order.code)}`);
  }),
);

router.post(
  '/pedidos/:code/enviar',
  asyncHandler(async (req, res) => {
    const order = await markOrderShipped(req.params.code, { tracking: req.body?.tracking });
    res.redirect(`/admin/pedidos/${encodeURIComponent(order.code)}`);
  }),
);

router.post(
  '/pedidos/:code/entregado',
  asyncHandler(async (req, res) => {
    const order = await markOrderDelivered(req.params.code);
    res.redirect(`/admin/pedidos/${encodeURIComponent(order.code)}`);
  }),
);

router.post(
  '/pedidos/:code/cancelar',
  asyncHandler(async (req, res) => {
    const order = await cancelOrder(req.params.code, {
      reason: req.body?.reason || 'cancelado_por_admin',
    });
    res.redirect(`/admin/pedidos/${encodeURIComponent(order.code)}`);
  }),
);

// ---------------- Campañas & Cupones ----------------
router.get(
  '/campanas',
  asyncHandler(async (req, res) => {
    const [settings, coupons] = await Promise.all([getStoreSettings(), listCoupons()]);
    res.render('admin/campaigns', { title: 'Campañas y Cupones', settings, coupons });
  }),
);

router.post(
  '/campanas/flash',
  asyncHandler(async (req, res) => {
    const active = req.body?.active === 'on' || req.body?.active === 'true';
    await updateStoreSettings({
      flashSale: {
        active,
        percent: Number(req.body?.percent) || 0,
        title: String(req.body?.title || '').trim(),
      },
    });
    res.redirect('/admin/campanas');
  }),
);

router.post(
  '/campanas/cupones',
  asyncHandler(async (req, res) => {
    await saveCoupon({
      code: req.body?.code,
      type: req.body?.type || 'percent',
      value: req.body?.value,
      maxUses: req.body?.maxUses,
      minSubtotal: req.body?.minSubtotal || 0,
      active: true,
    });
    res.redirect('/admin/campanas');
  }),
);

router.post(
  '/campanas/cupones/:code/toggle',
  asyncHandler(async (req, res) => {
    await toggleCouponActive(req.params.code);
    res.redirect('/admin/campanas');
  }),
);

// ---------------- Inventario ----------------
router.get(
  '/inventario',
  asyncHandler(async (req, res) => {
    const stockMap = await getStockMap();
    const { productos } = loadCatalog();
    const items = productos.map((p) => ({
      ...p,
      stockActual: Number.isFinite(stockMap[p.id]) ? stockMap[p.id] : 0,
    }));
    res.render('admin/inventory', { title: 'Inventario', items });
  }),
);

router.post(
  '/inventario/:id/stock',
  asyncHandler(async (req, res) => {
    await setProductStock(req.params.id, req.body?.stock);
    res.redirect('/admin/inventario');
  }),
);

// ---------------- Ajustes ----------------
router.get(
  '/ajustes',
  asyncHandler(async (req, res) => {
    const settings = await getStoreSettings();
    res.render('admin/settings', { title: 'Ajustes', settings });
  }),
);

router.post(
  '/ajustes',
  asyncHandler(async (req, res) => {
    await updateStoreSettings({
      shippingFlat: Math.max(0, Number(req.body?.shippingFlat) || 0),
      freeShippingMin: Math.max(0, Number(req.body?.freeShippingMin) || 0),
      whatsapp: String(req.body?.whatsapp || '').trim(),
      manualPaymentInfo: String(req.body?.manualPaymentInfo || '').trim(),
    });
    res.redirect('/admin/ajustes');
  }),
);

router.post(
  '/ajustes/password',
  asyncHandler(async (req, res) => {
    await changeAdminPassword(
      req.admin.email,
      req.body?.currentPassword,
      req.body?.newPassword,
    );
    res.redirect('/admin/ajustes');
  }),
);

// Manejo de errores dentro del panel
router.use((err, req, res, _next) => {
  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error('[admin]', err);
  res.status(status).type('text/plain').send(err.message || 'Error en el panel administrativo.');
});

export default router;
