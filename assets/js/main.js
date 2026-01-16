/**************************************************
 * MAIN.JS
 * Punto de entrada - ShopUniverses
 **************************************************/
import {
    cargarInventario,
    getInventario
} from "./data.js";

import {
    inicializarCarrito,
    getItemsCarrito
} from "./carrito.js";

(async function iniciarApp() {
    await cargarInventario();
    inicializarCarrito();

    console.log("✔ App inicializada");
    console.log("Inventario:", getInventario());
    console.log("Carrito:", getItemsCarrito());
})();

/**************************************************
 * NAV MOBILE — CERRAR AL HACER CLICK
 **************************************************/
document.addEventListener("DOMContentLoaded", () => {
    const navToggle = document.getElementById("nav-toggle");
    const navLinks = document.querySelectorAll(".nav-links a");

    if (!navToggle) return;

    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            navToggle.checked = false;
        });
    });
});
