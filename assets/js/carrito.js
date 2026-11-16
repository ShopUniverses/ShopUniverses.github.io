/**************************************************
 * CARRITO.JS
 * Gestión de carrito - ShopUniverses
 **************************************************/
import {
  reservarStockAPI,
  liberarReservaAPI,
  extenderReservasAPI,
  actualizarStockLocal,
  refrescarStock,
  getConfigSpin,
} from "./data.js";

const CARRITO_KEY = "shopuniverses_carrito";

/**
 * Estado interno del carrito
 */
let carrito = null;

/**************************************************
 * INICIALIZACIÓN
 **************************************************/

function inicializarCarrito() {
  const saved = localStorage.getItem(CARRITO_KEY);

  if (saved) {
    try {
      carrito = JSON.parse(saved);
    } catch {
      carrito = null;
    }
  }

  if (!carrito || !Array.isArray(carrito.items)) {
    carrito = {
      items: [],
      total: 0,
    };
    guardarCarrito();
  }
}

function guardarCarrito() {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
}

function recolectarReservasUnicas(items = carrito.items) {
  const map = new Map();
  for (const it of items) {
    if (it.reservationId && it.reservationToken && !map.has(it.reservationId)) {
      map.set(it.reservationId, {
        reservationId: it.reservationId,
        token: it.reservationToken,
      });
    }
  }
  return [...map.values()];
}

async function liberarSiExiste(reservationId, token) {
  if (!reservationId || !token) return;
  try {
    await liberarReservaAPI(reservationId, token);
  } catch (err) {
    if (err?.status !== 404) throw err;
  }
}

/**************************************************
 * MANEJO DE ÍTEMS
 **************************************************/

function agregarItem(item) {
  carrito.items.push(item);
  recalcularTotal();
}

/**
 * Elimina un ítem y libera la reserva en el servidor si corresponde
 */
async function eliminarItem(index) {
  const item = carrito.items[index];
  if (!item) return;

  // Caso 1: producto de catálogo (eliminación individual)
  if (item.tipo === "producto" && item.origen === "catalogo") {
    if (item.reservationId && item.reservationToken) {
      await liberarSiExiste(item.reservationId, item.reservationToken);
    }
    actualizarStockLocal(item.id, 1);
    carrito.items.splice(index, 1);
    recalcularTotal();
    return;
  }

  // Caso 2: paquete Spin o premio asociado -> eliminación atómica del paquete
  if (item.origen === "spin" || item.tipo.startsWith("spin_")) {
    const resId = item.reservationId || null;
    const resToken =
      item.reservationToken ||
      carrito.items.find((i) => resId && i.reservationId === resId && i.reservationToken)?.reservationToken ||
      null;

    if (resId && resToken) {
      await liberarSiExiste(resId, resToken);
    }

    if (resId) {
      carrito.items = carrito.items.filter((i) => i.reservationId !== resId);
    } else {
      carrito.items = carrito.items.filter(
        (i) => !(i.tipo === "producto" && i.origen === "spin") && !i.tipo.startsWith("spin_")
      );
    }

    recalcularTotal();
    await refrescarStock().catch(() => {});
  }
}

/**
 * Limpia el carrito completamente
 */
function limpiarCarrito() {
  carrito = {
    items: [],
    total: 0,
  };
  guardarCarrito();
}

/**************************************************
 * ÍTEMS ESPECIALES (SPIN)
 **************************************************/

function agregarSpinBase() {
  agregarItem({
    tipo: "spin_base",
    nombre: "Spin ShopUniverses (Paquete Estándar)",
    precio: getConfigSpin().precio_base,
  });
}

function agregarSpinPremium() {
  agregarItem({
    tipo: "spin_premium",
    nombre: "Spin Premium",
    precio: getConfigSpin().premium_precio,
  });
}

function agregarPaqueteSpinConfirmado({ mode, precioPaquete, prizes, reservationId, token, holdUntil }) {
  const esEstandar = mode === "estandar";
  agregarItem({
    tipo: esEstandar ? "spin_base" : "spin_premium",
    nombre: esEstandar ? "Spin ShopUniverses (Paquete Estándar)" : "Spin Premium",
    precio: precioPaquete,
    reservationId,
    reservationToken: token,
    holdUntil,
  });

  for (const p of prizes) {
    agregarItem({
      tipo: "producto",
      id: p.id,
      nombre: p.nombre,
      precio: 0,
      origen: "spin",
      reservationId,
      reservationToken: token,
    });
    actualizarStockLocal(p.id, -1);
  }
}

/**************************************************
 * PRODUCTOS
 **************************************************/

function agregarProductoDesdeSpin(producto) {
  agregarItem({
    tipo: "producto",
    id: producto.id,
    nombre: producto.nombre,
    precio: 0,
    origen: "spin",
  });
}

async function agregarProductoCatalogo(producto) {
  const res = await reservarStockAPI([{ id: producto.id, qty: 1 }]);

  agregarItem({
    tipo: "producto",
    id: producto.id,
    nombre: producto.nombre,
    precio: producto.precio_referencia ?? producto.precio,
    origen: "catalogo",
    reservationId: res.reservationId,
    reservationToken: res.token,
    holdUntil: res.holdUntil,
  });

  actualizarStockLocal(producto.id, -1);
}

/**************************************************
 * TOTALES
 **************************************************/

function recalcularTotal() {
  carrito.total = carrito.items.reduce((acc, item) => acc + (Number(item.precio) || 0), 0);
  guardarCarrito();
}

function getTotal() {
  return carrito.total;
}

function getItemsCarrito() {
  return carrito.items;
}

/**************************************************
 * CANCELACIÓN
 **************************************************/

async function cancelarCompraCompleta() {
  const reservas = recolectarReservasUnicas();
  if (reservas.length > 0) {
    await Promise.allSettled(reservas.map((r) => liberarSiExiste(r.reservationId, r.token)));
  }

  limpiarCarrito();
  await refrescarStock().catch(() => {});
}

/**************************************************
 * WHATSAPP
 **************************************************/

function generarMensajeWhatsApp() {
  let mensaje = "Hola\n";
  mensaje += "Quiero hacer este pedido de ShopUniverses:\n\n";

  carrito.items.forEach((item) => {
    mensaje += `• ${item.nombre} — $${item.precio}\n`;
  });

  mensaje += `\nTotal estimado: $${carrito.total}\n`;
  mensaje += "\nGracias.";

  return mensaje;
}

function enviarPedidoWhatsApp(numero) {
  const reservas = recolectarReservasUnicas();
  if (reservas.length > 0) {
    extenderReservasAPI(reservas).catch((err) => {
      console.warn("No se pudo extender reserva para WhatsApp:", err.message);
    });
  }

  const mensaje = generarMensajeWhatsApp();
  const params = new URLSearchParams({ text: mensaje });
  const url = `https://wa.me/${numero}?${params.toString()}`;

  window.open(url, "_blank");

  setTimeout(() => {
    limpiarCarrito();
  }, 500);
}

export {
  inicializarCarrito,
  agregarProductoCatalogo,
  agregarProductoDesdeSpin,
  agregarSpinBase,
  agregarSpinPremium,
  agregarPaqueteSpinConfirmado,
  eliminarItem,
  cancelarCompraCompleta,
  getItemsCarrito,
  getTotal,
  enviarPedidoWhatsApp,
};
