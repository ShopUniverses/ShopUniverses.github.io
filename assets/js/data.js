/**************************************************
 * DATA.JS
 * Capa de dominio y cliente HTTP - ShopUniverses
 * ------------------------------------------------
 * Toda lectura y modificación de stock se realiza
 * contra la API del servidor (/api/*), nunca directo
 * desde el navegador hacia Firestore.
 **************************************************/

const STORAGE_STOCK_KEY = "shopuniverses_stock";
const POLL_INTERVAL_MS  = 15_000;

let INVENTARIO   = null;
let _loadPromise = null;
let _subscribed  = false;

// Callbacks que se ejecutan cuando cambia el stock disponible
const _stockListeners = new Set();

/**
 * Registra una función que se ejecuta cada vez que
 * el stock se actualiza desde el servidor o localmente.
 */
function onStockChange(fn) {
  _stockListeners.add(fn);
}

function _notificarCambioStock() {
  _stockListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("onStockChange callback error:", e);
    }
  });
}

/**************************************************
 * CLIENTE HTTP (/api/*)
 **************************************************/

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Error de servidor (${res.status})`);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }

  return data;
}

async function apiPost(url, body) {
  return apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
}

async function reservarStockAPI(items) {
  return apiPost("/api/stock/reserve", { items });
}

async function liberarReservaAPI(reservationId, token) {
  return apiPost("/api/stock/release", { reservationId, token });
}

async function extenderReservasAPI(reservations) {
  return apiPost("/api/stock/hold", { reservations });
}

async function girarRuletaAPI(mode) {
  return apiPost("/api/spin/roll", { mode });
}

async function aceptarRuletaAPI(spinToken) {
  return apiPost("/api/spin/accept", { spinToken });
}

/**************************************************
 * INICIALIZACIÓN Y SINCRONIZACIÓN DE STOCK
 **************************************************/

async function cargarInventario() {
  if (INVENTARIO) return INVENTARIO;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const data = await apiFetch("/api/catalog");

    INVENTARIO = {
      config: data.config,
      productos: data.productos.map((p) => ({
        ...p,
        precio_referencia: p.precio ?? p.precio_referencia,
      })),
    };

    const stock = {};
    INVENTARIO.productos.forEach((p) => {
      stock[p.id] = Number.isFinite(p.stock) ? Math.max(0, p.stock) : 0;
    });
    guardarStock(stock);

    suscribirseAlStock();
    return INVENTARIO;
  })();

  try {
    return await _loadPromise;
  } finally {
    _loadPromise = null;
  }
}

async function refrescarStock() {
  const data = await apiFetch("/api/stock");
  const nuevo = data?.stock || {};
  const anterior = obtenerStock();

  const keys = new Set([...Object.keys(anterior), ...Object.keys(nuevo)]);
  let huboCambio = false;
  for (const k of keys) {
    if (anterior[k] !== nuevo[k]) {
      huboCambio = true;
      break;
    }
  }

  guardarStock(nuevo);
  if (huboCambio) {
    _notificarCambioStock();
  }
  return nuevo;
}

function suscribirseAlStock() {
  if (_subscribed) return;
  _subscribed = true;

  setInterval(() => {
    if (document.visibilityState === "visible") {
      refrescarStock().catch((e) => console.warn("No se pudo refrescar stock:", e.message));
    }
  }, POLL_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refrescarStock().catch((e) => console.warn("No se pudo refrescar stock:", e.message));
    }
  });
}

/**************************************************
 * STOCK — lectura y escritura local
 **************************************************/

function obtenerStock() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_STOCK_KEY)) || {};
  } catch {
    return {};
  }
}

function guardarStock(stock) {
  localStorage.setItem(STORAGE_STOCK_KEY, JSON.stringify(stock));
}

function actualizarStockLocal(id, delta) {
  const stock = obtenerStock();
  const actual = Number.isFinite(stock[id]) ? stock[id] : 0;
  stock[id] = Math.max(0, actual + delta);
  guardarStock(stock);
  _notificarCambioStock();
}

/**************************************************
 * FILTROS DE PRODUCTOS
 **************************************************/

function productosConStock() {
  if (!INVENTARIO || !Array.isArray(INVENTARIO.productos)) return [];
  const stock = obtenerStock();
  return INVENTARIO.productos.filter(
    (p) => Number.isFinite(stock[p.id]) && stock[p.id] > 0
  );
}

function getProductosCatalogo() {
  return productosConStock().filter((p) => p.flags?.catalogo);
}

function getProductosSpinEstandar() {
  return productosConStock().filter((p) => p.flags?.spin_estandar);
}

function getProductosSpinPremium() {
  return productosConStock().filter((p) => p.flags?.spin_premium);
}

/**************************************************
 * CONFIGURACIÓN
 **************************************************/

function getConfigSpin() {
  return INVENTARIO?.config?.spin || null;
}

function getInventario() {
  return INVENTARIO;
}

export {
  cargarInventario,
  getInventario,
  obtenerStock,
  refrescarStock,
  actualizarStockLocal,
  reservarStockAPI,
  liberarReservaAPI,
  extenderReservasAPI,
  girarRuletaAPI,
  aceptarRuletaAPI,
  getProductosCatalogo,
  getProductosSpinEstandar,
  getProductosSpinPremium,
  getConfigSpin,
  onStockChange,
};
