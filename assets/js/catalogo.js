/*
CATALOGO.JS
Render del catálogo con imagen
*/

document.addEventListener("DOMContentLoaded", async () => {
    await cargarInventario();
    inicializarCarrito();
    renderCatalogo();
    });

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
            <p><strong>$${producto.precio_referencia} COP</strong></p>
            <small>Stock disponible: ${stockActual}</small>
        </div>

        <div class="producto-accion">
            <button>Agregar al carrito</button>
        </div>
        `;

        const boton = card.querySelector("button");
        boton.addEventListener("click", () => {
        agregarProductoCatalogo(producto);
        renderCatalogo(); // 🔄 refresca stock
        alert("Producto agregado al carrito");
        });

        contenedor.appendChild(card);
    });
}
