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

Oferta adicional el Spin Estándar.

* Precio: **$8.000 COP**
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


# ShopUniverses — Web Oficial

Este repositorio contiene el desarrollo de la página web oficial de  **ShopUniverses** , un negocio de importaciones enfocado en la venta de productos mediante **catálogo tradicional** y una  **experiencia interactiva de compra basada en ruleta (Spin Wheel)** .

El proyecto está diseñado para operar  **sin backend propio** , desplegado sobre  **GitHub Pages** , utilizando **Firebase (Firestore)** como autoridad de inventario en tiempo casi real y **WhatsApp** como canal de cierre de pedidos.

Este README define  **la lógica definitiva del sistema** , las **reglas de negocio** y los **contratos funcionales** que deben respetarse antes de realizar pruebas o modificaciones.

---

## 🎯 Objetivo del Proyecto

* Liquidar inventario de forma eficiente y controlada
* Evitar sobreventa en escenarios multiusuario
* Ofrecer una experiencia de compra interactiva (Spin + Catálogo)
* Centralizar pedidos vía WhatsApp
* Mantener una arquitectura simple, auditable y escalable

---

## 🧠 Principios de Diseño (Reglas de Oro)

1. **El inventario nunca se duplica**
2. **Firebase es la autoridad global de stock**
3. **El Spin es una sesión volátil** (no persistente)
4. **El carrito no define reglas de negocio, solo ejecuta efectos**
5. **Cancelar implica rollback total del sistema**

---

## 📦 Arquitectura General

### Fuentes de datos

* **inventario.json**
  Fuente base de productos:
  * IDs
  * nombres
  * precios
  * stock máximo
  * flags de disponibilidad (catálogo / spin)
  * pesos probabilísticos
* **Firestore (Firebase)**
  Autoridad de stock compartido entre usuarios.
* **localStorage**
  Caché local sincronizada para:
  * stock operativo
  * carrito de compras

> ⚠️ El JSON  **nunca repone stock vendido** . Solo define límites.

---

## 🔄 Flujo de Inicialización (Todas las páginas)

1. `cargarInventario()`
   * Carga `inventario.json`
   * Inicializa stock local si no existe
   * Sincroniza stock desde Firestore
   * Valida integridad (no negativos, no sobrestock)
2. `inicializarCarrito()`
   * Recupera o crea el carrito persistente

---

## 🛍️ Catálogo de Productos

### Reglas

* Solo se muestran productos con:
  * `flags.catalogo === true`
  * stock > 0

### Flujo de compra

1. El usuario selecciona cantidad
2. Al agregar al carrito:
   * Se valida stock en Firebase
   * Se descuenta inmediatamente (reserva real)
   * Se sincroniza localStorage
   * Se actualiza la UI

📌 El catálogo  **reserva stock de forma inmediata** .

---

## 🎡 Spin Wheel (Sistema de Ruleta)

### Concepto clave

El Spin es una  **experiencia de compra transaccional diferida** :

* Girar **no descuenta stock**
* Aceptar premios **sí descuenta stock**

### Tipos de Spin

* **Spin Estándar**
* **Spin Premium**

👉 Son  **modos independientes** , no jerárquicos:

* Se pueden ejecutar en cualquier orden
* Se pueden repetir
* Se pueden cancelar

---

### 🌀 Estado del Spin

* Vive **solo en memoria**
* No se persiste en localStorage
* Un refresh o salida de la página:
  * invalida el spin
  * no requiere rollback (no hubo reserva)

---

### Flujo del Spin

1. El usuario inicia un Spin
2. Gira la ruleta (premios temporales)
3. El sistema solo valida disponibilidad visual
4. Al aceptar premios:
   * Se agrega el ítem Spin al carrito
   * Se agregan los productos (precio $0)
   * Se descuenta stock en Firebase
   * Se sincroniza localStorage

---

### Atomicidad del Spin

* El Spin es **un paquete indivisible**
* No se pueden eliminar productos individuales del Spin
* Si se elimina el Spin:
  * se eliminan todos los productos asociados
  * se restaura todo el stock

---

## 🛒 Carrito de Compras

### Tipos de ítems

* `spin_base`
* `spin_premium`
* `producto`
  * origen: catálogo o spin

### Reglas

* Productos de catálogo:
  * pueden eliminarse individualmente
  * restauran stock
* Productos de Spin:
  * **no son eliminables individualmente**

---

### Cancelación de compra

Al cancelar:

* Se vacía el carrito
* Se eliminan todos los spins
* Se restauran todos los productos en Firebase
* Se sincroniza localStorage
* Se reinicia cualquier estado activo

📌 Cancelar = **reset total del sistema**

---

## 📲 Pedido por WhatsApp

* El carrito genera un mensaje estructurado
* El mensaje incluye:
  * productos
  * spins
  * total estimado

Después de enviar:

* El carrito se limpia
* El estado del Spin se descarta

---

## 🧩 Estructura del Proyecto

```
/
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
│   ├── /fonts
│   ├── /js
│   │   ├── data.js        # Dominio e inventario
│   │   ├── firebase.js    # Firebase / Firestore
│   │   ├── spin.js        # Lógica de ruleta
│   │   ├── catalogo.js    # Catálogo
│   │   ├── carrito.js     # Estado del carrito
│   │   ├── carrito.page.js# UI del carrito
│   │   ├── main.js        # Bootstrap
│   └── /img
│
└── /data
    └── inventario.json
```

---

## 🧪 Pruebas y Mantenimiento

Antes de modificar código:

* Validar reglas de negocio descritas aquí
* No introducir persistencia del Spin
* No romper atomicidad del paquete Spin
* No permitir sobreventa

---

## 🚧 Estado del Proyecto

🚧 En desarrollo activo

La prioridad es  **consistencia, control de inventario y experiencia de usuario** , antes que complejidad técnica.

---

## 📜 Licencia

MIT License — Uso libre para el proyecto ShopUniverses.

---

## 🧭 Nota Final

Este README es el  **contrato técnico del proyecto** .

Si algo no encaja con lo descrito aquí,  **el código debe adaptarse** , no al revés.
