/**************************************************
 * MAIN.JS
 * Punto de entrada - ShopUniverses
 **************************************************/

(async function iniciarApp() {
  await cargarInventario();
  inicializarCarrito();

  console.log("✔ App inicializada");
  console.log("Inventario:", getInventario());
  console.log("Carrito:", getItemsCarrito());
  console.log("Spin:", getSpinState());
})();
