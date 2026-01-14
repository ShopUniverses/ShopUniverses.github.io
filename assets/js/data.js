/**************************************************
 * DATA.JS
 * Capa de dominio - ShopUniverses
 **************************************************/

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
 * STOCK
 **************************************************/

function obtenerStock() {
  return JSON.parse(
    localStorage.getItem(STORAGE_STOCK_KEY)
  ) || {};
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
function descontarStock(productoId) {
  const stock = obtenerStock();

  if (!stock[productoId] || stock[productoId] <= 0) {
    return false;
  }

  stock[productoId]--;
  guardarStock(stock);

  return true;
}

/**
 * Restaura stock (por cancelación)
 */
function restaurarStock(productosIds) {
  const stock = obtenerStock();

  productosIds.forEach(id => {
    if (stock[id] !== undefined) {
      stock[id]++;
    }
  });

  guardarStock(stock);
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

