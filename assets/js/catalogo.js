/*
CATALOGO.JS
Render del catálogo con imagen, contador y stock seguro
*/
import {
    cargarInventario,
    getProductosCatalogo,
    obtenerStock,
    onStockChange       // ← tiempo real
} from "./data.js";

import {
    agregarProductoCatalogo,
    inicializarCarrito
} from "./carrito.js";

// Sin cache fijo — getProductosCatalogo() siempre lee stock fresco
document.addEventListener("DOMContentLoaded", async () => {
    await cargarInventario();
    inicializarCarrito();

    renderCatalogo();

    // Cuando Firebase notifica un cambio de stock desde cualquier cliente,
    // re-renderiza el catálogo completo con datos frescos.
    // Esto evita que un usuario vea stock disponible que ya fue comprado.
    onStockChange(() => renderCatalogo());
});

    /* ===============================
    UTILIDAD DE PRECIO
    =============================== */
    function formatearPrecio(valor) {
    return valor.toLocaleString("es-CO");
    }

    /* ===============================
    RENDER DEL CATÁLOGO
    =============================== */
    function renderCatalogo() {
    const contenedor = document.getElementById("catalogo");
    contenedor.innerHTML = "";

    // Siempre recalcula desde stock actual — nunca desde cache
    const productos = getProductosCatalogo();

    if (productos.length === 0) {
        contenedor.innerHTML = "<p>No hay productos disponibles.</p>";
        return;
    }

    productos.forEach(producto => {
        // Stock leído en este momento exacto, no capturado en closure
        const stockActual = obtenerStock()[producto.id] ?? 0;

        const card = document.createElement("div");
        card.className = "card producto-card";

        card.innerHTML = `
        <div class="producto-imagen">
            <img src="./${producto.imagen}" alt="${producto.nombre}">
        </div>

        <div class="producto-info">
            <h3>${producto.nombre}</h3>
            <p><strong>$${formatearPrecio(producto.precio_referencia)}</strong></p>
            <small>Stock disponible: ${stockActual}</small>
        </div>

        <div class="producto-accion">
            <div class="cantidad-control">
            <button class="menos">−</button>
            <span class="cantidad">0</span>
            <button class="mas">+</button>
            </div>
            <button class="agregar" disabled>Agregar al carrito</button>
        </div>
        `;
        
        /* ===============================
        LÓGICA DEL CONTADOR
        =============================== */
        let cantidad = 0;

        const spanCantidad = card.querySelector(".cantidad");
        const btnMenos = card.querySelector(".menos");
        const btnMas = card.querySelector(".mas");
        const btnAgregar = card.querySelector(".agregar");
        const stockLabel = card.querySelector("small");

        const actualizarBoton = () => {
            btnAgregar.disabled = cantidad === 0 || stockActual === 0;
            btnMas.disabled = cantidad >= stockActual;
            btnMenos.disabled = cantidad === 0;
        };

        const actualizarStockVisual = () => {
            const restante = stockActual - cantidad;
            stockLabel.textContent = `Stock disponible: ${restante}`;
        };

        btnMenos.onclick = () => {
        if (cantidad > 0) {
            cantidad--;
            spanCantidad.textContent = cantidad;
            actualizarBoton();
            actualizarStockVisual();
        }
        };

        btnMas.onclick = () => {
        if (cantidad < stockActual) {
            cantidad++;
            spanCantidad.textContent = cantidad;
            actualizarBoton();
            actualizarStockVisual();
        }
        };

        btnAgregar.onclick = async () => {
        if (cantidad === 0) return;

        btnAgregar.disabled = true;
        btnAgregar.textContent = 'Agregando...';

        for (let i = 0; i < cantidad; i++) {
            await agregarProductoCatalogo(producto);
        }

        alert(`Agregaste ${cantidad} unidad(es) al carrito`);
        renderCatalogo(); // 🔄 refresca stock visual con datos actualizados
        };

        contenedor.appendChild(card);
        actualizarStockVisual();
        actualizarBoton();
    });
}