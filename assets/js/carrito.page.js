import {
    inicializarCarrito,
    getItemsCarrito,
    getTotal,
    cancelarCompraCompleta,
    enviarPedidoWhatsApp
} from "./carrito.js";

import {
    restaurarStock
} from "./data.js";

import { 
    eliminarItem 
} from "./carrito.js";

/**************************************************
 * UTILIDAD
 **************************************************/
function log(msg) {
    const el = document.getElementById("log");
    if (el) el.innerHTML += msg + "<br>";
}

/**************************************************
 * RENDER
 **************************************************/
function renderCarrito() {
    const ul = document.getElementById("lista-carrito");
    const items = getItemsCarrito();

    ul.innerHTML = "";

    if (items.length === 0) {
        ul.innerHTML = `
        <li style="text-align:center; padding:40px; color:var(--color-text-muted);">
            El carrito está orbitando vacío... 🚀
        </li>`;
    } else {
        items.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "flex-between";
        li.style.padding = "15px 0";
        li.style.borderBottom = "1px solid var(--color-border)";

        li.innerHTML = `
            <div>
            <span style="display:block; font-weight:bold;">${item.nombre}</span>
            <small style="color:var(--color-accent)">
                ${item.tipo === "producto" ? "Producto" : "Spin Reward"}
            </small>
            </div>
            <div class="flex" style="align-items:center; gap:15px;">
            <span>$${item.precio.toLocaleString()}</span>
            </div>
        `;

        if (item.tipo === "producto" && item.origen === "catalogo") {
            const btn = document.createElement("button");
            btn.textContent = "✕";
            btn.className = "secondary";
            btn.style.padding = "5px 10px";
            btn.onclick = async () => {
            eliminarItem(index);              // elimina + recalcula + guarda
            await restaurarStock([item.id]);  // Firebase + local
            log("Producto eliminado del carrito");
            renderCarrito();

            };
            li.querySelector(".flex").appendChild(btn);
        }

        ul.appendChild(li);
        });
    }

    document.getElementById("total").textContent =
        getTotal().toLocaleString();
}

/**************************************************
 * ACCIONES EXPUESTAS A HTML
 **************************************************/
window.cancelarCompra = () => {
    cancelarCompraCompleta();
    log("❌ Compra cancelada y stock restaurado");
    renderCarrito();
};

window.enviarPedidoWA = () => {
    if (getItemsCarrito().length === 0) {
        alert("El carrito está vacío");
        return;
    }
    enviarPedidoWhatsApp("573207096148");
};

/**************************************************
 * INIT
 **************************************************/
document.addEventListener("DOMContentLoaded", () => {
    inicializarCarrito();
    renderCarrito();
});
