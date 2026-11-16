/**************************************************
 * MAIN.JS
 * Punto de entrada - ShopUniverses
 **************************************************/
import {
    cargarInventario,
    getInventario,
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
 * NAV MOBILE & NAVEGACIÓN PRINCIPAL
 **************************************************/
function initNavigation() {
    const navToggle = document.getElementById("nav-toggle");
    const navLinks = document.querySelectorAll(".nav-links a");

    if (navToggle) {
        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                navToggle.checked = false;
            });
        });
    }

    document.getElementById("btnIrSpin")?.addEventListener("click", () => {
        window.location.href = "./spin.html";
    });

    document.getElementById("btnIrCatalogo")?.addEventListener("click", () => {
        window.location.href = "./catalogo.html";
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavigation);
} else {
    initNavigation();
}
