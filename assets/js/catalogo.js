    /**************************************************
     * CATALOGO.JS
     * Render básico del catálogo
     **************************************************/

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
        const div = document.createElement("div");
        div.className = "producto";

        div.innerHTML = `
        <h3>${producto.nombre}</h3>
        <p><strong>Precio:</strong> $${producto.precio_referencia}</p>
        <small>Stock disponible: ${obtenerStock()[producto.id]}</small><br>
        <button>Agregar al carrito</button>
        `;

        const boton = div.querySelector("button");
        boton.addEventListener("click", () => {
        agregarProductoCatalogo(producto);
        renderCatalogo(); // 🔄 refrescar stock
        alert("Producto agregado al carrito");
        });

        contenedor.appendChild(div);
    });
}
