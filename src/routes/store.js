// ========================================================
// ROUTES/STORE.JS — Vistas públicas renderizadas en servidor (SSR)
// ========================================================
import { Router } from 'express';
import { listCategories } from '../lib/catalog.js';
import { getStoreSettings } from '../lib/promotions.js';
import { DEPARTMENTS, getOrderByCode } from '../lib/orders.js';
import { isWompiConfigured, buildWompiCheckoutConfig } from '../lib/payments/wompi.js';
import { asyncHandler } from '../lib/http.js';

const router = Router();

// Inyectar ajustes dinámicos y evento Flash en todas las vistas públicas
router.use(
  asyncHandler(async (req, res, next) => {
    const settings = await getStoreSettings();
    res.locals.flashSale = settings.flashSale;
    res.locals.storeSettings = settings;
    next();
  }),
);

// Redirecciones 301 para URLs .html heredadas
router.get('/index.html', (req, res) => res.redirect(301, '/'));
router.get('/catalogo.html', (req, res) => res.redirect(301, '/catalogo'));
router.get('/spin.html', (req, res) => res.redirect(301, '/spin'));
router.get('/carrito.html', (req, res) => res.redirect(301, '/carrito'));

// Vistas principales
router.get('/', (req, res) => {
  res.render('home', { title: null, activeNav: 'inicio' });
});

router.get('/catalogo', (req, res) => {
  res.render('catalog', {
    title: 'Catálogo',
    activeNav: 'catalogo',
    categories: listCategories(),
  });
});

router.get('/spin', (req, res) => {
  res.render('spin', { title: 'Spin', activeNav: 'spin' });
});

router.get('/carrito', (req, res) => {
  res.render('cart', { title: 'Carrito', activeNav: 'carrito' });
});

router.get('/terminos-y-condiciones', (req, res) => {
  res.render('legal/terms', { title: 'Términos y Condiciones', activeNav: '' });
});

router.get('/politica-de-privacidad', (req, res) => {
  res.render('legal/privacy', { title: 'Política de Privacidad (Habeas Data)', activeNav: '' });
});

router.get('/reversion-de-pago', (req, res) => {
  res.render('legal/reversal', { title: 'Reversión de Pago y PQRS', activeNav: '' });
});

router.get('/checkout', (req, res) => {
  res.render('checkout', {
    title: 'Finalizar compra',
    activeNav: 'carrito',
    departments: DEPARTMENTS,
    wompiEnabled: isWompiConfigured(),
    settings: res.locals.storeSettings,
  });
});

router.get(
  '/pedido/:code',
  asyncHandler(async (req, res, next) => {
    const order = await getOrderByCode(req.params.code);
    if (!order) return next();

    const wompi =
      order.paymentMethod === 'wompi' && order.status === 'pendiente' && isWompiConfigured()
        ? buildWompiCheckoutConfig(order)
        : null;

    res.render('order', {
      title: `Pedido ${order.code}`,
      activeNav: '',
      order,
      wompi,
      settings: res.locals.storeSettings,
    });
  }),
);

export default router;
