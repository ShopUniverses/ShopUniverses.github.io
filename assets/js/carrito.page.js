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

        const esSpin = item.tipo.startsWith("spin_");
        const esProductoCatalogo = item.tipo === "producto" && item.origen === "catalogo";
        const esProductoSpin = item.tipo === "producto" && item.origen === "spin";

        // Los productos del spin no se muestran con botón — se eliminan junto al paquete
        // Solo mostramos botón en: paquetes spin (spin_base/premium) y productos de catálogo
        const mostrarBoton = esSpin || esProductoCatalogo;

        let etiqueta = "Producto";
        if (esSpin) etiqueta = "🎡 Paquete Spin — elimina todos los premios";
        if (esProductoSpin) etiqueta = "Premio Spin";

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
            btn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.disabled = true;
                btn.textContent = "...";
                await eliminarItem(index);
                log(esSpin ? "Paquete spin eliminado y stock restaurado" : "Producto eliminado del carrito");
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

// CORRECCIÓN: async + await para esperar que Firestore
// confirme el rollback antes de limpiar la UI
async function cancelarCompra() {
    const btn = document.getElementById('btn-vaciar');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Restaurando...';
    }

    await cancelarCompraCompleta();

    log("❌ Compra cancelada y stock restaurado");
    renderCarrito();

    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Vaciar Carrito';
    }
}

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
document.addEventListener("DOMContentLoaded", async () => {
    await cargarInventario();
    inicializarCarrito();
    renderCarrito();

    // Conectar botones via JS — evita problema con onclick en módulos ES
    document.getElementById('btn-enviar-wa')?.addEventListener('click', () => {
        window.enviarPedidoWA();
    });

    document.getElementById('btn-vaciar')?.addEventListener('click', () => {
        cancelarCompra();
    });
});