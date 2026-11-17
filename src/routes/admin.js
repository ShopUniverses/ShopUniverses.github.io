// ========================================================
// ROUTES/ADMIN.JS — Panel Administrativo Seguro (/admin)
// ========================================================
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import {
  getCatalog,
  getProductAsync,
  listCategoriesAsync,
  ensureCatalogSeeded,
  upsertProduct,
  toggleProductActive,
} from '../lib/catalog.js';
import { getStockMap, setProductStock, listStockMovements } from '../lib/inventory.js';
import { saveMediaToFirestore } from '../lib/images.js';
import { parseBulkCatalogFile, importCatalogItems, exportCatalogCsv } from '../lib/import-products.js';
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

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file && file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    const err = new Error('El archivo debe ser una imagen válida (PNG, JPG o WebP).');
    err.status = 400;
    return cb(err);
  },
});

const uploadImportFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

function parseCheckbox(val) {
  return val === 'on' || val === 'true' || val === '1' || val === true;
}

const MULTIPART_POST_PATHS = [
  /^\/productos\/nuevo$/,
  /^\/productos\/importar$/,
  /^\/productos\/(?!semilla$)[^/]+$/,
];

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
  if (req.method !== 'POST') return next();
  const deferredForMulter =
    req.is('multipart/form-data') && MULTIPART_POST_PATHS.some((re) => re.test(req.path));
  if (deferredForMulter) return next();
  return checkCsrf(req, res, next);
});

// ---------------- Dashboard ----------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [orders, stockMap, settings, catalog] = await Promise.all([
      listOrders(),
      getStockMap(),
      getStoreSettings(),
      getCatalog({ includeInactive: true }),
    ]);

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

// ---------------- Productos ----------------
async function buildProductsViewData(req, extra = {}) {
  const [{ productos, source }, stockMap, categories] = await Promise.all([
    getCatalog({ includeInactive: true }),
    getStockMap(),
    listCategoriesAsync(),
  ]);

  const queryText = String(req.query?.q || '').trim().toLowerCase();
  const activeCategory = String(req.query?.categoria || '').trim();

  const allItems = productos.map((p) => ({
    ...p,
    stockActual: Number.isFinite(stockMap[p.id]) ? stockMap[p.id] : 0,
  }));

  const items = allItems.filter((p) => {
    if (activeCategory && p.categoria !== activeCategory) return false;
    if (queryText) {
      const hay = `${p.nombre} ${p.id} ${p.categoria}`.toLowerCase();
      if (!hay.includes(queryText)) return false;
    }
    return true;
  });

  return {
    title: 'Productos',
    items,
    totalCount: allItems.length,
    categories,
    catalogSource: source,
    queryText: String(req.query?.q || '').trim(),
    activeCategory,
    flashOk: req.query?.ok ? String(req.query.ok) : null,
    importSummary: null,
    ...extra,
  };
}

router.get(
  '/productos',
  asyncHandler(async (req, res) => {
    res.render('admin/products', await buildProductsViewData(req));
  }),
);

router.get(
  '/productos/nuevo',
  asyncHandler(async (req, res) => {
    const categories = await listCategoriesAsync();
    res.render('admin/product-form', {
      title: 'Nuevo producto',
      isNew: true,
      product: {
        id: '',
        nombre: '',
        categoria: categories[0] || 'Llaveros',
        precio_referencia: 0,
        costo: 0,
        imagen: '/assets/img/perfil/2.webp',
        peso_spin: 10,
        activo: true,
        flags: { catalogo: true, spin_estandar: false, spin_premium: false },
      },
      stockActual: 0,
      categories,
      error: null,
    });
  }),
);

router.post(
  '/productos/nuevo',
  uploadImage.single('foto'),
  checkCsrf,
  asyncHandler(async (req, res) => {
    const categories = await listCategoriesAsync();
    let imageUrl = String(req.body?.imagen || '').trim();
    const draft = {
      id: String(req.body?.id || '').trim(),
      nombre: String(req.body?.nombre || '').trim(),
      categoria: String(req.body?.categoria || '').trim() || 'Otros',
      precio_referencia: req.body?.precio_referencia,
      costo: req.body?.costo || 0,
      imagen: imageUrl || '/assets/img/perfil/2.webp',
      peso_spin: req.body?.peso_spin || 10,
      activo: parseCheckbox(req.body?.activo),
      flags: {
        catalogo: parseCheckbox(req.body?.catalogo),
        spin_estandar: parseCheckbox(req.body?.spin_estandar),
        spin_premium: parseCheckbox(req.body?.spin_premium),
      },
    };
    const initialStock = req.body?.stock !== undefined && req.body.stock !== '' ? req.body.stock : 0;

    try {
      if (req.file && req.file.buffer?.length) {
        const uploaded = await saveMediaToFirestore(req.file.buffer);
        imageUrl = uploaded.url;
        draft.imagen = imageUrl;
      }

      const saved = await upsertProduct(
        {
          ...draft,
          imagen: imageUrl || undefined,
        },
        { isNew: true },
      );

      await setProductStock(saved.id, initialStock, {
        reason: 'creacion_admin',
        note: 'Producto creado desde el panel',
        actor: req.admin.email,
      });

      res.redirect(`/admin/productos?ok=${encodeURIComponent(`Producto "${saved.nombre}" creado.`)}`);
    } catch (err) {
      const status = Number.isInteger(err?.status) && err.status < 500 ? err.status : 400;
      res.status(status).render('admin/product-form', {
        title: 'Nuevo producto',
        isNew: true,
        product: draft,
        stockActual: initialStock,
        categories,
        error: err?.message || 'No fue posible crear el producto.',
      });
    }
  }),
);

router.get(
  '/productos/plantilla.csv',
  asyncHandler(async (req, res) => {
    const csv = await exportCatalogCsv();
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="shopuniverses-catalogo.csv"');
    res.send(csv);
  }),
);

router.get(
  '/productos/exportar.json',
  asyncHandler(async (req, res) => {
    const [{ config: cfg, productos }, stockMap] = await Promise.all([
      getCatalog({ includeInactive: true }),
      getStockMap(),
    ]);
    const payload = {
      config: cfg,
      exportedAt: new Date().toISOString(),
      productos: productos.map((p) => ({
        ...p,
        stock: Number.isFinite(stockMap[p.id]) ? stockMap[p.id] : 0,
      })),
    };
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="shopuniverses-catalogo.json"');
    res.send(JSON.stringify(payload, null, 2));
  }),
);

router.post(
  '/productos/semilla',
  asyncHandler(async (req, res) => {
    const result = await ensureCatalogSeeded();
    const msg = result.alreadySeeded
      ? 'El catálogo ya está sincronizado en Firestore.'
      : `Se migraron ${result.seeded} productos iniciales a Firestore.`;
    res.redirect(`/admin/productos?ok=${encodeURIComponent(msg)}`);
  }),
);

router.post(
  '/productos/importar',
  uploadImportFile.single('archivo'),
  checkCsrf,
  asyncHandler(async (req, res) => {
    try {
      const items = parseBulkCatalogFile({
        buffer: req.file?.buffer,
        filename: req.file?.originalname,
        mimetype: req.file?.mimetype,
      });
      const overwrite = parseCheckbox(req.body?.overwrite);
      const updateStock = parseCheckbox(req.body?.updateStock);
      const summary = await importCatalogItems(items, {
        overwrite,
        updateStock,
        actor: req.admin.email,
        note: `Importación (${req.file?.originalname || 'archivo'})`,
      });
      res.render('admin/products', await buildProductsViewData(req, { importSummary: summary }));
    } catch (err) {
      const status = Number.isInteger(err?.status) && err.status < 500 ? err.status : 400;
      res.status(status).render(
        'admin/products',
        await buildProductsViewData(req, {
          importError: err?.message || 'Error procesando el archivo.',
        }),
      );
    }
  }),
);

router.get(
  '/productos/:id',
  asyncHandler(async (req, res, next) => {
    const [product, stockMap, categories] = await Promise.all([
      getProductAsync(req.params.id, { includeInactive: true }),
      getStockMap(),
      listCategoriesAsync(),
    ]);
    if (!product) return next();
    const stockActual = Number.isFinite(stockMap[product.id]) ? stockMap[product.id] : 0;
    res.render('admin/product-form', {
      title: `Editar: ${product.nombre}`,
      isNew: false,
      product,
      stockActual,
      categories,
      error: null,
    });
  }),
);

router.post(
  '/productos/:id',
  uploadImage.single('foto'),
  checkCsrf,
  asyncHandler(async (req, res, next) => {
    const [existing, categories] = await Promise.all([
      getProductAsync(req.params.id, { includeInactive: true }),
      listCategoriesAsync(),
    ]);
    if (!existing) return next();

    let imageUrl = String(req.body?.imagen || '').trim() || existing.imagen;
    const draft = {
      id: existing.id,
      nombre: String(req.body?.nombre || '').trim(),
      categoria: String(req.body?.categoria || '').trim() || existing.categoria,
      precio_referencia: req.body?.precio_referencia,
      costo: req.body?.costo ?? existing.costo,
      imagen: imageUrl,
      peso_spin: req.body?.peso_spin ?? existing.peso_spin,
      activo: parseCheckbox(req.body?.activo),
      flags: {
        catalogo: parseCheckbox(req.body?.catalogo),
        spin_estandar: parseCheckbox(req.body?.spin_estandar),
        spin_premium: parseCheckbox(req.body?.spin_premium),
      },
    };
    const nextStockRaw = req.body?.stock;

    try {
      if (req.file && req.file.buffer?.length) {
        const uploaded = await saveMediaToFirestore(req.file.buffer);
        imageUrl = uploaded.url;
        draft.imagen = imageUrl;
      }

      const saved = await upsertProduct({ ...draft, imagen: imageUrl }, { isNew: false });

      if (nextStockRaw !== undefined && String(nextStockRaw).trim() !== '') {
        await setProductStock(saved.id, nextStockRaw, {
          reason: 'edicion_producto',
          note: 'Actualizado al editar producto',
          actor: req.admin.email,
        });
      }

      res.redirect(`/admin/productos?ok=${encodeURIComponent(`Producto "${saved.nombre}" actualizado.`)}`);
    } catch (err) {
      const status = Number.isInteger(err?.status) && err.status < 500 ? err.status : 400;
      res.status(status).render('admin/product-form', {
        title: `Editar: ${existing.nombre}`,
        isNew: false,
        product: draft,
        stockActual: nextStockRaw ?? 0,
        categories,
        error: err?.message || 'No fue posible actualizar el producto.',
      });
    }
  }),
);

router.post(
  '/productos/:id/toggle',
  asyncHandler(async (req, res) => {
    const updated = await toggleProductActive(req.params.id);
    const label = updated.activo === false ? 'ocultado' : 'activado';
    res.redirect(`/admin/productos?ok=${encodeURIComponent(`Producto "${updated.nombre}" ${label}.`)}`);
  }),
);

// ---------------- Inventario ----------------
router.get(
  '/inventario',
  asyncHandler(async (req, res) => {
    const [{ productos }, stockMap, movements] = await Promise.all([
      getCatalog({ includeInactive: true }),
      getStockMap(),
      listStockMovements(30),
    ]);
    const items = productos.map((p) => ({
      ...p,
      stockActual: Number.isFinite(stockMap[p.id]) ? stockMap[p.id] : 0,
    }));
    res.render('admin/inventory', { title: 'Inventario', items, movements });
  }),
);

router.post(
  '/inventario/:id/stock',
  asyncHandler(async (req, res) => {
    await setProductStock(req.params.id, req.body?.stock, {
      reason: 'ajuste_admin',
      note: String(req.body?.note || '').trim(),
      actor: req.admin.email,
    });
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
  const isSizeErr = err?.code === 'LIMIT_FILE_SIZE';
  const status = isSizeErr ? 400 : Number.isInteger(err?.status) ? err.status : 500;
  const message = isSizeErr
    ? 'El archivo excede el tamaño máximo permitido.'
    : err?.message || 'Error en el panel administrativo.';
  if (status >= 500) console.error('[admin]', err);
  res.status(status).type('text/plain').send(message);
});

export default router;
