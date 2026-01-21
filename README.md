## ShopUniverses — Web Oficial

Este repositorio contiene el desarrollo de la página web oficial de  **ShopUniverses** , un negocio de importaciones enfocado en la venta de productos mediante catálogo tradicional y una experiencia interactiva de compra basada en  **Spin Wheel (ruleta de productos)** .

El sitio está diseñado para funcionar completamente sobre  **GitHub Pages** , sin backend propio ni pasarelas de pago, utilizando tecnologías web estándar y gestión de pedidos vía  **WhatsApp** .

---

## Objetivo del Proyecto

* Liquidar inventario de forma eficiente
* Recuperar capital inmovilizado
* Ofrecer una experiencia de compra interactiva y visual
* Centralizar pedidos y pagos a través de WhatsApp
* Mantener una arquitectura simple, controlable y escalable

---

## Funcionalidades Principales

### 🛍️ Catálogo de Productos

* Visualización del inventario disponible
* Información básica del producto
* Indicador de stock
* Agregado manual al carrito

---

### 🎡 Spin Wheel (Sistema Único)

Sistema de venta por experiencia con precio fijo.

**Condiciones del Spin Estándar**

* Precio base: **$30.000 COP**
* Incluye **5 productos**
* El usuario realiza giros hasta completar los 5 productos
* Cada producto ganado:
  * Se agrega automáticamente al carrito
  * Tiene valor **$0** (ya incluido en el paquete)
  * Descuenta stock

**Flujo**

1. El usuario acepta el Spin
2. Se agrega al carrito:
   * *Spin ShopUniverses – Paquete Estándar* → $30.000
3. Antes de cada giro:
   * El sistema valida stock disponible
   * La ruleta se actualiza dinámicamente
4. El usuario gira y obtiene un producto
5. El proceso se repite hasta completar los 5 productos

---

### 💎 Spin Premium (Opcional)

Oferta adicional al finalizar el Spin Estándar.

* Precio adicional: **$8.000 COP**
* Giro único
* Productos de mayor valor o menor margen
* Stock y probabilidades controladas
* Si el usuario acepta:
  * Se agrega al carrito
  * Se ejecuta el giro
  * Se descuenta inventario

---

### 🛒 Carrito de Compras

* Consolida productos del catálogo y del spin
* Muestra:
  * Productos ganados
  * Precio base del Spin
  * Total estimado
* Permite cancelar la compra

**Cancelación**

* Si el usuario cancela:
  * Se vacía el carrito
  * Se restauran los productos al inventario
  * Se reinicia el estado del Spin

---

### 📲 Generación de Pedido por WhatsApp

* El carrito genera automáticamente un mensaje estructurado
* El mensaje se envía al WhatsApp oficial de ShopUniverses
* El pago y la logística se gestionan manualmente con el cliente

Ejemplo de mensaje generado:

<pre class="overflow-visible! px-0!" data-start="3162" data-end="3343"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>Hola 👋  
Quiero hacer este pedido de ShopUniverses:

🛒 Productos:
</span><span>- Producto A (Spin)</span><span>
</span><span>- Producto B (Spin)</span><span>
</span><span>- Producto C (Spin Premium)</span><span>

💰 Total estimado: $38.000

Gracias.
</span></span></code></div></div></pre>

---

## Arquitectura del Proyecto

<pre class="overflow-visible! px-0!" data-start="3380" data-end="3853"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(--spacing(9)+var(--header-height))] @w-xl/main:top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>/
├── index.html
├── catalogo.html
├── spin.html
├── carrito.html
├── sobre-nosotros.html
├── 404.html
├── README.md
│
├── /assets
│   ├── /css
│   │   ├── spin.css
│   │   ├── styles.css
│   │   ├── theme.css
│   /fonts
|   |   ├── horizon_outlined.otf
│   │   ├── horizon.otf
│   │   ├── TAN-b.otf
│   ├── /js
│   │   ├── data.js
│   │   ├── firebase.js
│   │   ├── spin.js
│   │   ├── catalogo.js
│   │   ├── carrito.js
│   │   ├── carrito.page.js
│   │   ├── main.js
│   │
│   └── /img
│   │   ├── /favicon
│   │   |    ├── favicon-16x16.png
│   │   |    ├── favicon-32x32.png
│   │   |    ├── favicon.ico
│   │   ├── /img_catalogo
│   │   |    ├── Acá están todas las imagenés necesarias para el catalogo
│   │   ├── /perfil
│   │   |    ├── logos en nomb4re del 1 al 10 con formato png para uso
|
└── /data
    └── inventario.json
</span></span></code></div></div></pre>

---

## Manejo de Inventario (Modo Actual)

### Opción A — Frontend (Implementación actual)

* Inventario cargado desde `inventario.json`
* Controlado mediante JavaScript
* Estado gestionado con `localStorage`
* Antes de cada giro:
  * Se valida stock real
  * La ruleta se actualiza dinámicamente
* Evita mostrar o entregar productos sin disponibilidad

**Nota:**

Este modo no es multiusuario en tiempo real, pero es suficiente y estable para la fase actual del negocio y compatible con GitHub Pages.

---

## Diseño y Marca

* Paleta de colores basada en:
  * Manual de Marca ShopUniverses
  * Ajustes visuales del CSS original
* Tipografías:
  * **Horizon** → títulos y logotipo
  * **Tan Buster** → textos, botones y UI
* Diseño enfocado en:
  * Claridad
  * Conversión
  * Experiencia visual

---

## Tecnologías Utilizadas

* HTML5
* CSS3 (variables, modularización)
* JavaScript (Vanilla)
* GitHub Pages
* WhatsApp URL Scheme

---

## Estado del Proyecto

🚧 En desarrollo activo

El proyecto se construye de forma modular, priorizando estabilidad, control de inventario y experiencia de usuario antes de agregar complejidad adicional.

---

## Licencia

MIT License

Uso libre para el proyecto ShopUniverses.

---

## Notas Finales

Este proyecto está diseñado para resolver un problema comercial real:  **liquidar inventario de forma eficiente** , sin sobreingeniería ni dependencias innecesarias. La arquitectura permite evolucionar a soluciones más robustas conforme crezca el volumen de ventas.
