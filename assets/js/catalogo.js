/*
CATALOGO.JS
Render del catálogo con imagen, contador y stock seguro
*/

document.addEventListener("DOMContentLoaded", async () => {
    await cargarInventario();
    inicializarCarrito();
    renderCatalogo();
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

    const productos = getProductosCatalogo();

    if (productos.length === 0) {
        contenedor.innerHTML = "<p>No hay productos disponibles.</p>";
        return;
    }

    productos.forEach(producto => {
        const stockActual = obtenerStock()[producto.id];

        if (stockActual <= 0) return;

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

        const actualizarBoton = () => {
        btnAgregar.disabled = cantidad === 0;
        };

        btnMenos.onclick = () => {
        if (cantidad > 0) {
            cantidad--;
            spanCantidad.textContent = cantidad;
            actualizarBoton();
        }
        };

        btnMas.onclick = () => {
        if (cantidad < stockActual) {
            cantidad++;
            spanCantidad.textContent = cantidad;
            actualizarBoton();
        }
        };

        btnAgregar.onclick = () => {
        if (cantidad === 0) return;

        for (let i = 0; i < cantidad; i++) {
            agregarProductoCatalogo(producto);
        }

        alert(`Agregaste ${cantidad} unidad(es) al carrito`);
        renderCatalogo(); // 🔄 refresca stock visual
        };

        contenedor.appendChild(card);
    });
}
