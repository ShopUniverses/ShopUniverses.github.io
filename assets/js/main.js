/**************************************************
 * MAIN.JS
 * Punto de entrada - ShopUniverses
 **************************************************/

(async function iniciarApp() {
  // 1. Cargar inventario
  await cargarInventario();

  // 2. Inicializar carrito
  inicializarCarrito();

  // 3. Restaurar estado de spin si existía
  cargarSpinState();

  console.log("✔ App inicializada correctamente");

  // Debug opcional
  console.log("Inventario:", INVENTARIO);
  console.log("Carrito:", getItemsCarrito());
  console.log("Spin:", getSpinState());
})();

/**************************************************
 * FUNCIONES DE CONTROL (para UI)
 **************************************************/

function iniciarCompraSpin() {
  iniciarSpin();
  agregarSpinBase();
  console.log("🎡 Spin iniciado");
}

function girar() {
  const ganador = girarSpinEstandar();

  if (ganador) {
    agregarProductoDesdeSpin(ganador);
    console.log("🎁 Ganaste:", ganador.nombre);
  } else {
    console.log("⚠️ No se pudo girar");
  }
}

function aceptarPremium() {
  agregarSpinPremium();
  const ganador = aceptarSpinPremium();

  if (ganador) {
    agregarProductoDesdeSpin(ganador);
    console.log("💎 Premium ganado:", ganador.nombre);
  }
}

function cancelarCompra() {
  cancelarCompra();
  console.log("❌ Compra cancelada");
}

function enviarPedido(numero) {
  enviarPedidoWhatsApp(numero);
}
