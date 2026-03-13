/**************************************************
 * DATA.JS
 * Capa de dominio - ShopUniverses
 *
 * CAMBIOS vs versión anterior:
 *  1. Se importa y usa onSnapshot → stock en tiempo real
 *  2. suscribirseAlStock() arranca el listener automáticamente
 *     dentro de cargarInventario(), sin cambiar la firma pública
 *  3. Se añade un Set de callbacks para que spin.js / catalogo.js
 *     puedan reaccionar cuando el stock cambia remotamente
 *  4. Se exporta onStockChange(fn) para registrar esos callbacks
 *  5. Se exporta obtenerStock para que spin.js lo use directamente
 **************************************************/

import {
  db,
  doc,
  getDocs,
  collection,
  runTransaction,
  onSnapshot          // ← NUEVO
} from "./firebase.js";


const INVENTARIO_URL    = "/data/inventario.json";
const STORAGE_STOCK_KEY = "shopuniverses_stock";

let INVENTARIO = null;

// Callbacks que se ejecutan cuando Firebase notifica un cambio de stock
const _stockListeners = new Set();

/**
 * Registra una función que se ejecuta cada vez que
 * el stock se actualiza desde Firebase en tiempo real.
 * Uso en spin.js:  onStockChange(() => drawWheel(mode));
 */
function onStockChange(fn) {
  _stockListeners.add(fn);
}

function _notificarCambioStock() {
  _stockListeners.forEach(fn => {
    try { fn(); } catch (e) { console.error("onStockChange callback error:", e); }
  });
}

/**************************************************
 * INICIALIZACIÓN
 **************************************************/

async function cargarInventario() {
  if (INVENTARIO) return INVENTARIO;

  const response = await fetch(INVENTARIO_URL);
  INVENTARIO = await response.json();

  inicializarStock();

  // Lectura inicial desde Firebase
  await sincronizarStockDesdeFirebase();

  validarStockContraInventario();

  // ← NUEVO: arranca el listener en tiempo real
  suscribirseAlStock();

  return INVENTARIO;
}

/**
 * Inicializa el stock en localStorage si no existe todavía
 */
function inicializarStock() {
  if (localStorage.getItem(STORAGE_STOCK_KEY)) return;

  const stockInicial = {};
  INVENTARIO.productos.forEach(p => {
    stockInicial[p.id] = p.stock;
  });
  localStorage.setItem(STORAGE_STOCK_KEY, JSON.stringify(stockInicial));
}

/**
 * Lectura única al arrancar (garantiza sincronía antes del primer render)
 */
async function sincronizarStockDesdeFirebase() {
  const stockLocal = obtenerStock();
  const snapshot   = await getDocs(collection(db, "stock"));

  snapshot.forEach(docSnap => {
    const remoto = docSnap.data().Cantidad;   // ← mayúscula
    if (typeof remoto === "number" && Number.isFinite(remoto)) {
      stockLocal[docSnap.id] = remoto;
    }
  });

  guardarStock(stockLocal);
}

/**
 * NUEVO — Listener persistente: cada vez que Firestore cambia,
 * actualiza localStorage y avisa a los suscriptores.
 */
function suscribirseAlStock() {
  onSnapshot(collection(db, "stock"), (snapshot) => {
    const stockLocal = obtenerStock();
    let huboCambio = false;

    snapshot.docChanges().forEach(change => {
      const remoto = change.doc.data().Cantidad;
      if (typeof remoto !== "number" || !Number.isFinite(remoto)) return;

      const id = change.doc.id;
      stockLocal[id] = remoto;

      // "added" = carga inicial (todos los docs llegan así al arrancar)
      // "modified" = cambio real desde cualquier cliente → siempre notificar
      if (change.type === "modified") {
        huboCambio = true;
      }
    });

    // Siempre guardar (mantiene localStorage fresco)
    guardarStock(stockLocal);
    validarStockContraInventario();

    // Solo avisar a la UI cuando hubo un cambio real
    if (huboCambio) {
      _notificarCambioStock();
    }
  });
}

/**************************************************
 * VALIDACIÓN DE INTEGRIDAD
 **************************************************/

function validarStockContraInventario() {
  const stock = obtenerStock();

  INVENTARIO.productos.forEach(p => {
    const valor = stock[p.id];

    if (!Number.isFinite(valor)) {
      stock[p.id] = p.stock;
      return;
    }
    if (stock[p.id] > p.stock) stock[p.id] = p.stock;
    if (stock[p.id] < 0)       stock[p.id] = 0;
  });

  guardarStock(stock);
}

/**************************************************
 * STOCK — lectura y escritura
 **************************************************/

function obtenerStock() {
  return JSON.parse(localStorage.getItem(STORAGE_STOCK_KEY)) || {};
}

function guardarStock(stock) {
  localStorage.setItem(STORAGE_STOCK_KEY, JSON.stringify(stock));
}

/**
 * Descuenta una unidad de stock con transacción atómica en Firebase
 */
async function descontarStock(productoId) {
  const ref = doc(db, "stock", productoId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists())          throw new Error("Producto no existe en stock");
    if (snap.data().Cantidad <= 0) throw new Error("Sin stock disponible");

    tx.update(ref, { Cantidad: snap.data().Cantidad - 1 });
  });

  // Sincronía local inmediata (el listener también lo hará, pero esto es más rápido)
  const stock = obtenerStock();
  stock[productoId] = Math.max(0, (stock[productoId] || 0) - 1);
  guardarStock(stock);
}

/**
 * Restaura stock (por cancelación)
 */
async function restaurarStock(productosIds) {
  const stockLocal = obtenerStock();

  for (const id of productosIds) {
    const ref = doc(db, "stock", id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;

      const nuevaCantidad = snap.data().Cantidad + 1;
      tx.update(ref, { Cantidad: nuevaCantidad });
      stockLocal[id] = nuevaCantidad;
    });
  }

  guardarStock(stockLocal);
}

/**************************************************
 * FILTROS DE PRODUCTOS
 *
 * CORRECCIÓN: todas usan obtenerStock() en tiempo de llamada,
 * no un snapshot guardado al arrancar.
 **************************************************/

function productosConStock() {
  const stock = obtenerStock();    // ← siempre fresco desde localStorage
  return INVENTARIO.productos.filter(p =>
    Number.isFinite(stock[p.id]) && stock[p.id] > 0
  );
}

function getProductosCatalogo() {
  return productosConStock().filter(p => p.flags.catalogo);
}

function getProductosSpinEstandar() {
  return productosConStock().filter(p => p.flags.spin_estandar);
}

function getProductosSpinPremium() {
  return productosConStock().filter(p => p.flags.spin_premium);
}

/**************************************************
 * SPIN — selección ponderada
 **************************************************/

function seleccionarProductoPonderado(productos) {
  const bolsa = [];
  productos.forEach(p => {
    for (let i = 0; i < (p.peso_spin || 1); i++) bolsa.push(p);
  });
  if (bolsa.length === 0) return null;
  return bolsa[Math.floor(Math.random() * bolsa.length)];
}

/**************************************************
 * CONFIGURACIÓN
 **************************************************/

function getConfigSpin() {
  return INVENTARIO.config.spin;
}

function getInventario() {
  return INVENTARIO;
}

export {
  cargarInventario,
  getInventario,
  obtenerStock,
  descontarStock,
  restaurarStock,
  getProductosCatalogo,
  getProductosSpinEstandar,
  getProductosSpinPremium,
  getConfigSpin,
  onStockChange,         // ← NUEVO: para que spin.js / catalogo.js reaccionen
};
