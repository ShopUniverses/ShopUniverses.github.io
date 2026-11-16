# 🌌 ShopUniverses — Tienda Oficial & Catálogo Web

Plataforma de comercio electrónico de **ShopUniverses** ([shopuniverses.com](https://shopuniverses.com)), especializada en productos de importación, papelería creativa, accesorios y una experiencia de compra interactiva mediante ruleta (**Spin Wheel**).

Este repositorio documenta la arquitectura del sistema, el **Plan Maestro de Migración a Stack Fullstack (Netlify + Node.js + Firebase)**, las **normas de ejecución por ramas en Git** y el **marco de cumplimiento legal y regulatorio para comercio electrónico en Colombia**.

---

## 📋 Tabla de Contenidos
1. [Arquitectura del Sistema](#-arquitectura-del-sistema)
2. [Estrategia de Trabajo con Ramas (Git Branching Model)](#-estrategia-de-trabajo-con-ramas-git-branching-model)
3. [Cumplimiento Legal y Normativo en Colombia](#-cumplimiento-legal-y-normativo-en-colombia)
4. [Pasarela de Pagos & Seguridad Transaccional](#-pasarela-de-pagos--seguridad-transaccional)
5. [Plan Maestro de Migración por Fases](#-plan-maestro-de-migración-por-fases)
6. [Reglas de Oro del Negocio e Inventario](#-reglas-de-oro-del-negocio-e-inventario)
7. [Guía de Desarrollo y Entorno Local](#-guía-de-desarrollo-y-entorno-local)

---

## 🏗 Arquitectura del Sistema

El proyecto evoluciona desde un sitio estático en GitHub Pages hacia una **arquitectura Serverless desacoplada de alto rendimiento**:

```text
                                [ Cliente / Navegador ]
                             (https://shopuniverses.com)
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         [ CDN Global de Netlify ]                 [ Netlify Functions ]
          (HTML, CSS, JS, Fuentes,                 (Express API + SSR EJS)
             Imágenes WebP)                                   │
                                                              ▼
                                                 [ Capa Lógica de Negocio ]
                                                ├── Ruleta Segura (/api/spin)
                                                ├── Carrito & Checkout (/api/orders)
                                                ├── Campañas & Cupones (/api/coupons)
                                                ├── Panel Admin (/admin)
                                                └── Webhooks Pasarela (/api/payments)
                                                              │
                                         ┌────────────────────┴────────────────────┐
                                         ▼                                         ▼
                            [ Google Firebase Firestore ]                 [ Pasarela de Pago ]
                            (Stock en tiempo real, backup                  (Wompi Bancolombia /
                              de catálogo y órdenes)                       Comprobante Nequi)
```

### Componentes Clave:
* **Hosting & CDN:** Netlify (Plan Starter, $0 USD) con vinculación directa del dominio `shopuniverses.com` y certificado SSL automático.
* **Backend de Aplicación:** Node.js (ES Modules) ejecutado mediante Netlify Functions (`serverless-http`), brindando APIs seguras sin costos de servidores inactivos.
* **Persistencia de Datos:** Google Firebase Firestore (`shopuniverses-inventario`), administrado en el servidor vía **Firebase Admin SDK** (aislando credenciales del navegador).
* **Optimización Multimedia:** Pipeline con **Sharp** / Netlify Image CDN para servir imágenes WebP comprimidas.

---

## 🌿 Estrategia de Trabajo con Ramas (Git Branching Model)

Para garantizar estabilidad y control de calidad, **queda prohibido hacer commits directos a `main`**. Todo trabajo se estructurará bajo el estándar GitFlow adaptado:

```text
  main (Producción - Despliegue automático a shopuniverses.com)
   │
   └── develop (Staging - Integración y pruebas previas)
        │
        ├── feature/migracion-backend-netlify
        ├── feature/firebase-admin-stock
        ├── feature/spin-engine-seguro
        ├── feature/pasarela-wompi-checkout
        ├── feature/cumplimiento-legal-sic
        └── fix/correccion-reserva-stock
```

### Reglas de Ejecución:
1. **`main` (Protegida):** Código estable en producción. Solo recibe merges aprobados desde `develop` mediante Pull Request (PR).
2. **`develop` (Rama de Integración):** Base para la consolidación de nuevas características.
3. **`feature/<nombre-tarea>`:** Ramas de desarrollo creadas a partir de `develop`. Ejemplo:
   * `git checkout develop`
   * `git checkout -b feature/firebase-admin-sdk`
4. **`fix/<nombre-bug>`:** Correcciones puntuales surgidas durante pruebas.
5. **Convención de Commits Semánticos:**
   * `feat: ...` Nueva característica o módulo.
   * `fix: ...` Corrección de error o inconsistencia.
   * `docs: ...` Modificaciones en documentación o README.
   * `legal: ...` Actualizaciones de T&C, políticas de privacidad o textos normativos.
   * `refactor: ...` Mejora de código sin cambiar comportamiento externo.

---

## ⚖️ Cumplimiento Legal y Normativo en Colombia

La plataforma opera bajo el marco legal comercial, digital y de protección al consumidor de la República de Colombia supervisado por la **Superintendencia de Industria y Comercio (SIC)**:

### 1. Régimen de Protección de Datos (Ley 1581 de 2012 y Dec. 1377 de 2013)
* **Prohibición de Checkboxes Premarcados:** Todo formulario de captura de datos (checkout, contacto) debe contar con una casilla de verificación **desmarcada por defecto**:
  > *"He leído y acepto la [Política de Tratamiento de Información](#) y los [Términos y Condiciones](#)."*
* **Canales Comerciales (Ley 2300 de 2023 - "Dejen de fregar"):** Autorización expresa y separada si se van a enviar ofertas o notificaciones vía WhatsApp, SMS o correo electrónico, respetando estrictamente los horarios hábiles permitidos por ley.
* **Derechos ARCO y PQRS:** La Política de Tratamiento de Información (PTI) visible en el footer debe detallar el canal de atención (correo electrónico) y plazos máximos legales de respuesta (10 días hábiles para consultas, 15 días hábiles para reclamos).

### 2. Estatuto del Consumidor en Comercio Electrónico (Ley 1480 de 2011)
* **Derecho de Retracto (Art. 47 y Ley 2439 de 2024):**
  * El cliente tiene **5 días hábiles** a partir de la entrega del producto para ejercer su derecho al retracto.
  * Por mandato de la **Ley 2439 de 2024**, la devolución del dinero debe realizarse en un plazo máximo de **15 días calendario** desde que el consumidor lo solicita.
* **Reversión del Pago (Art. 51 y Decreto 587 de 2016):**
  * Mecanismo formal habilitado en la web para que el consumidor solicite la reversión del pago dentro de los **5 días hábiles** siguientes cuando:
    1. Haya sido víctima de fraude o suplantación.
    2. Corresponda a una operación no solicitada.
    3. El producto adquirido no sea recibido.
    4. El producto entregado esté defectuoso o no corresponda a lo solicitado.
* **Transparencia en Precios:** Todos los precios deben expresarse en **Pesos Colombianos (COP)** con impuestos (IVA) y costos de envío discriminados con total claridad antes de que el cliente realice el pago.
* **Identificación y Enlace SIC (Art. 50):** El footer debe contener el nombre comercial, Razón Social / Cédula / NIT, ciudad de domicilio, canales de atención y un **enlace directo y visible al portal de la SIC**: [www.sic.gov.co](https://www.sic.gov.co).

---

## 💳 Pasarela de Pagos & Seguridad Transaccional

### 1. Pasarela Principal: Wompi (Bancolombia)
* **Métodos habilitados:** Transferencia directa **Nequi**, Botón Bancolombia, PSE (todos los bancos colombianos), Tarjetas de Crédito y Débito.
* **Pasarela de Respaldo:** Pago manual vía transferencia Nequi/Bancolombia con subida de comprobante para revisión en el panel `/admin`.

### 2. Medidas de Seguridad de Grado Bancario:
* **Cumplimiento PCI-DSS Nivel 1:** El servidor de ShopUniverses **nunca manipula ni almacena números de tarjeta ni códigos CVV**. La recolección de datos la procesa el Widget/Checkout encriptado de Wompi.
* **Validación de Webhooks con Firma Criptográfica:** Cada notificación de pago enviada por Wompi es autenticada en el backend comparando la firma `x-event-checksum` con un algoritmo SHA-256 y la clave secreta privada de la tienda.
* **Idempotencia Transaccional:** Cada orden tiene un `order_id` y `reference` únicos. Si un webhook se envía más de una vez, el backend reconoce la transacción previa y evita cobros duplicados o descuentos inconsistentes en stock.
* **Reserva de Inventario con Expiración:** Al generar la orden, el stock queda reservado durante **15 minutos**. Si el pago no es completado en este lapso, el sistema libera automáticamente los artículos para otros compradores.
* **Protección Antifraude:** Limitación de peticiones por minuto (`express-rate-limit`) en las rutas de checkout para mitigar ataques automatizados de prueba de tarjetas (*card testing*).

---

## 🚀 Plan Maestro de Migración por Fases

| Fase | Objetivo | Rama Asociada | Entregables |
| :--- | :--- | :--- | :--- |
| **Fase 1: Setup & Entorno** | Preparar la estructura modular tipo Kobra y configuración para Netlify. | `feature/setup-base-netlify` | • `netlify.toml` configurado.<br>• Servidor Express modular (`src/server.js`).<br>• Variables de entorno (`.env.example`). |
| **Fase 2: Conexión Firebase Admin** | Migrar la gestión de stock del frontend hacia el backend. | `feature/firebase-admin` | • `src/lib/firebase.js` con Firebase Admin SDK.<br>• Endpoints seguros para lectura y reserva de stock transaccional.<br>• Aislamiento de claves privadas. |
| **Fase 3: Portabilidad de la Ruleta (Spin Engine)** | Convertir la ruleta en un módulo protegido en servidor. | `feature/spin-engine-seguro` | • Endpoint `/api/spin` que calcula probabilidades y premios en servidor.<br>• Frontend Canvas conectado al endpoint.<br>• Eliminación de manipulación de stock en `localStorage`. |
| **Fase 4: Catálogo & Optimización Sharp** | Carga masiva de productos y optimización de medios. | `feature/catalogo-sharp` | • Script de ingesta desde `inventario.json`.<br>• Conversión de imágenes de catálogo a WebP optimizado.<br>• Renderizado SSR / dinámico del catálogo. |
| **Fase 5: Checkout, Cupones & Pasarela** | Integrar pasarela de pago, cupones limitados y cierre de pedidos. | `feature/checkout-wompi` | • Checkout integrado con Wompi Widget.<br>• Endpoint de Webhooks criptográficos (`/api/payments/webhook`).<br>• Módulo de Cupones limitados (ej. 15 primeros) y Descuentos Flash de tienda.<br>• Opción de cierre manual por WhatsApp con resumen estructurado. |
| **Fase 6: Marco Legal, Panel Admin & Acceso Oculto** | Panel administrativo, botón oculto en footer y contratos legales. | `feature/legal-colombia-sic` | • Acceso discreto al panel admin en footer.<br>• Dashboard admin con gestión de órdenes, stock y cupones.<br>• Footer con enlace a [www.sic.gov.co](https://www.sic.gov.co) y datos comerciales.<br>• Vistas de `/terminos-y-condiciones` y `/politica-de-privacidad`.<br>• Checkboxes no premarcados en formularios de checkout. |
| **Fase 7: Despliegue en Dominio Oficial** | Publicación final y vinculación de DNS. | `main` | • Conexión de `shopuniverses.com` en Netlify con SSL activo.<br>• Pruebas de compra end-to-end (sandbox y producción). |

---

## 💎 Reglas de Oro del Negocio e Inventario

1. **La Autoridad Global es Firebase:** Ningún cliente web puede dictar si un producto tiene o no stock; la única fuente de verdad reside en Firestore validada por el backend.
2. **El Carrito es Pasivo:** El carrito local no reserva stock permanente; la reserva formal se produce al iniciar el intento de compra.
3. **Rollback Automático:** Si una compra falla, es rechazada por la pasarela o el tiempo de sesión expira, el sistema restituye de forma atómica las cantidades reservadas.
4. **La Ruleta es Transaccional:** Solo se descuentan artículos del inventario cuando la tirada de ruleta ha sido validada y confirmada en el servidor.

---

## 🛠 Guía de Desarrollo y Entorno Local

### Prerrequisitos
* **Node.js:** Versión 20 o superior (recomendado 22+).
* **Git:** Para control de versiones por ramas.
* **Netlify CLI (Opcional para emulación local):** `npm install -g netlify-cli`

### Inicio Rápido
1. Clonar el repositorio y cambiarse a la rama de trabajo:
   ```bash
   git checkout develop
   ```
2. Instalar dependencias del proyecto:
   ```bash
   npm install
   ```
3. Configurar variables de entorno copiando el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
4. Iniciar el entorno de desarrollo:
   ```bash
   npm run dev
   ```

---

*Desarrollado para ShopUniverses — Todos los derechos reservados © 2026.*
