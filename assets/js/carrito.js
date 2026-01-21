/**************************************************
 * CARRITO.JS
 * Gestión de carrito - ShopUniverses
 **************************************************/
import {
  descontarStock,
  restaurarStock,
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
    carrito = JSON.parse(saved);
  } else {
    carrito = {
      items: [],
      total: 0
    };
    guardarCarrito();
  }
}

function guardarCarrito() {
  localStorage.setItem(
    CARRITO_KEY,
    JSON.stringify(carrito)
  );
}

/**************************************************
 * MANEJO DE ÍTEMS
 **************************************************/

function agregarItem(item) {
  carrito.items.push(item);
  recalcularTotal();
}

/**
 * Elimina un ítem y restaura stock si corresponde
 */
function eliminarItem(index) {
  const item = carrito.items[index];
  if (!item) return;

  // 🔒 Restaurar stock SOLO si es producto real
  if (item.tipo === "producto") {
    restaurarStock([item.id]);
  }

  carrito.items.splice(index, 1);
  recalcularTotal();
}

/**
 * Limpia el carrito completamente
 */
function limpiarCarrito() {
  carrito = {
    items: [],
    total: 0
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
    precio: getConfigSpin().precio_base
  });
}

function agregarSpinPremium() {
  agregarItem({
    tipo: "spin_premium",
    nombre: "Spin Premium",
    precio: getConfigSpin().premium_precio
  });
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
    origen: "spin"
  });
}

function agregarProductoCatalogo(producto) {
  agregarItem({
    tipo: "producto",
    id: producto.id,
    nombre: producto.nombre,
    precio: producto.precio_referencia,
    origen: "catalogo"
  });

  // Descontar stock real
  descontarStock(producto.id);
}

/**************************************************
 * TOTALES
 **************************************************/

function recalcularTotal() {
  carrito.total = carrito.items.reduce(
    (acc, item) => acc + item.precio,
    0
  );
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

function cancelarCompraCompleta() {
  const productos = carrito.items
    .filter(i => i.tipo === "producto")
    .map(i => i.id);

  restaurarStock(productos);
  limpiarCarrito();

  if (typeof limpiarSpinState === "function") {
    limpiarSpinState();
  }
}

/**************************************************
 * WHATSAPP
 **************************************************/

function generarMensajeWhatsApp() {
  let mensaje = "Hola\n";
  mensaje += "Quiero hacer este pedido de ShopUniverses:\n\n";

  carrito.items.forEach(item => {
    mensaje += `• ${item.nombre} — $${item.precio}\n`;
  });

  mensaje += `\nTotal estimado: $${carrito.total}\n`;
  mensaje += "\nGracias.";

  return mensaje;
}

function enviarPedidoWhatsApp(numero) {
  const mensaje = generarMensajeWhatsApp();
  const params = new URLSearchParams({ text: mensaje });
  const url = `https://wa.me/${numero}?${params.toString()}`;

  window.open(url, "_blank");

  setTimeout(() => {
    limpiarCarrito();
    if (typeof limpiarSpinState === "function") {
      limpiarSpinState();
    }
  }, 500);
}

export {
  inicializarCarrito,
  agregarProductoCatalogo,
  agregarProductoDesdeSpin,
  agregarSpinBase,
  agregarSpinPremium,
  eliminarItem,
  cancelarCompraCompleta,
  getItemsCarrito,
  getTotal,
  enviarPedidoWhatsApp,
};
