/**************************************************
 * DATA.JS
 * Capa de dominio - ShopUniverses
 **************************************************/

/*Importar Firebase*/
import { db, doc, getDoc, runTransaction } from "./firebase.js";


const INVENTARIO_URL = "/data/inventario.json";
const STORAGE_STOCK_KEY = "shopuniverses_stock";

/**
 * Estado interno (no tocar desde fuera)
 */
let INVENTARIO = null;

/**************************************************
 * INICIALIZACIÓN
 **************************************************/

/**
 * Carga el inventario desde el JSON
 * Debe llamarse UNA vez al iniciar cualquier página
 */
async function cargarInventario() {
  if (INVENTARIO) return INVENTARIO;

  const response = await fetch(INVENTARIO_URL);
  INVENTARIO = await response.json();

  inicializarStock();
  validarStockContraInventario(); // 🔐 ajuste clave

  return INVENTARIO;
}

/**
 * Inicializa el stock en localStorage si no existe
 */
function inicializarStock() {
  if (localStorage.getItem(STORAGE_STOCK_KEY)) return;

  const stockInicial = {};

  INVENTARIO.productos.forEach(producto => {
    stockInicial[producto.id] = producto.stock;
  });

  localStorage.setItem(
    STORAGE_STOCK_KEY,
    JSON.stringify(stockInicial)
  );
}

/**************************************************
 * VALIDACIÓN DE INTEGRIDAD
 **************************************************/

/**
 * Valida el stock activo contra el inventario base
 * - NO repone unidades vendidas
 * - SOLO inicializa faltantes
 * - Limita al stock máximo del JSON
 */
function validarStockContraInventario() {
  const stock = obtenerStock();

  INVENTARIO.productos.forEach(producto => {
    // Si no existe, se inicializa
    if (stock[producto.id] === undefined) {
      stock[producto.id] = producto.stock;
    }

    // Nunca permitir más que el máximo teórico
    if (stock[producto.id] > producto.stock) {
      stock[producto.id] = producto.stock;
    }
  });

  guardarStock(stock);
}

/**************************************************
 * STOCK
 **************************************************/

async function obtenerStock() {
  const stockLocal = JSON.parse(
    localStorage.getItem(STORAGE_STOCK_KEY)
  );

  if (stockLocal) return stockLocal;

  const stockRemoto = {};

  for (const producto of INVENTARIO.productos) {
    const ref = doc(db, "stock", producto.id);
    const snap = await getDoc(ref);

    stockRemoto[producto.id] = snap.exists()
      ? snap.data().cantidad
      : 0;
  }

  localStorage.setItem(
    STORAGE_STOCK_KEY,
    JSON.stringify(stockRemoto)
  );

  return stockRemoto;
}


function guardarStock(stock) {
  localStorage.setItem(
    STORAGE_STOCK_KEY,
    JSON.stringify(stock)
  );
}

/**
 * Descuenta una unidad de stock
 */
async function descontarStock(productoId) {
  const ref = doc(db, "stock", productoId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists() || snap.data().cantidad <= 0) {
      throw new Error("Sin stock disponible");
    }

    tx.update(ref, {
      cantidad: snap.data().cantidad - 1
    });
  });

  // Invalidar cache local
  localStorage.removeItem(STORAGE_STOCK_KEY);
}


/**
 * Restaura stock (por cancelación)
 */
async function restaurarStock(productosIds) {
  for (const id of productosIds) {
    const ref = doc(db, "stock", id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;

      tx.update(ref, {
        cantidad: snap.data().cantidad + 1
      });
    });
  }

  localStorage.removeItem(STORAGE_STOCK_KEY);
}


/**************************************************
 * FILTROS DE PRODUCTOS
 **************************************************/

function productosConStock() {
  const stock = obtenerStock();

  return INVENTARIO.productos.filter(p =>
    stock[p.id] > 0
  );
}

/**
 * Catálogo
 */
function getProductosCatalogo() {
  return productosConStock().filter(p =>
    p.flags.catalogo
  );
}

/**
 * Spin estándar
 */
function getProductosSpinEstandar() {
  return productosConStock().filter(p =>
    p.flags.spin_estandar
  );
}

/**
 * Spin premium
 */
function getProductosSpinPremium() {
  return productosConStock().filter(p =>
    p.flags.spin_premium
  );
}

/**************************************************
 * SPIN (SELECCIÓN PONDERADA)
 **************************************************/

function seleccionarProductoPonderado(productos) {
  const bolsa = [];

  productos.forEach(producto => {
    for (let i = 0; i < producto.peso_spin; i++) {
      bolsa.push(producto);
    }
  });

  if (bolsa.length === 0) return null;

  const indice = Math.floor(
    Math.random() * bolsa.length
  );

  return bolsa[indice];
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
  getProductosSpinPremium
};
