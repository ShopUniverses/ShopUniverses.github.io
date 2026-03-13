import {
    inicializarCarrito,
    getItemsCarrito,
    getTotal,
    cancelarCompraCompleta,
    enviarPedidoWhatsApp,
    eliminarItem
} from "./carrito.js";

import { cargarInventario } from "./data.js";

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

            const esPaqueteSpin = item.tipo.startsWith("spin_");
            const esProductoCatalogo = item.tipo === "producto" && item.origen === "catalogo";
            const esProductoSpin = item.tipo === "producto" && item.origen === "spin";

            let etiqueta = "Producto";
            if (esPaqueteSpin)  etiqueta = "🎡 Paquete Spin";
            if (esProductoSpin) etiqueta = "Premio Spin";

            // Productos individuales del spin NO tienen botón —
            // se eliminan junto al paquete spin automáticamente
            const mostrarBoton = esPaqueteSpin || esProductoCatalogo;

            li.innerHTML = `
                <div>
                    <span style="display:block; font-weight:bold;">${item.nombre}</span>
                    <small style="color:var(--color-accent)">${etiqueta}</small>
                </div>
                <div class="flex" style="align-items:center; gap:15px;">
                    <span>$${item.precio.toLocaleString()}</span>
                </div>
            `;

            if (mostrarBoton) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = "✕";
                btn.className = "secondary";
                btn.style.padding = "5px 10px";
                btn.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    btn.disabled = true;
                    btn.textContent = "...";
                    await eliminarItem(index);
                    log(esPaqueteSpin
                        ? "🎡 Paquete spin eliminado y stock restaurado"
                        : "✕ Producto eliminado del carrito");
                    renderCarrito();
                });
                li.querySelector(".flex").appendChild(btn);
            }

            ul.appendChild(li);
        });
    }

    document.getElementById("total").textContent = getTotal().toLocaleString();
}

/**************************************************
 * ACCIONES
 **************************************************/
async function cancelarCompra() {
    const btn = document.getElementById("btn-vaciar");
    if (btn) { btn.disabled = true; btn.textContent = "Restaurando..."; }

    await cancelarCompraCompleta();

    log("❌ Compra cancelada y stock restaurado");
    renderCarrito();

    if (btn) { btn.disabled = false; btn.textContent = "Vaciar Carrito"; }
}

function enviarPedidoWA() {
    if (getItemsCarrito().length === 0) {
        alert("El carrito está vacío");
        return;
    }
    enviarPedidoWhatsApp("573207096148");
}

/**************************************************
 * INIT — conectar todo via addEventListener
 * NUNCA usar onclick inline con type="module"
 **************************************************/
document.addEventListener("DOMContentLoaded", async () => {
    await cargarInventario();
    inicializarCarrito();
    renderCarrito();

    document.getElementById("btn-enviar-wa")
        ?.addEventListener("click", enviarPedidoWA);

    document.getElementById("btn-vaciar")
        ?.addEventListener("click", cancelarCompra);
});