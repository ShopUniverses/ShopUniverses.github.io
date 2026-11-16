// ========================================================
// ROUTES/STORE.JS — Vistas públicas renderizadas en servidor (SSR)
// ========================================================
import { Router } from 'express';
import { listCategories } from '../lib/catalog.js';

const router = Router();

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

export default router;
