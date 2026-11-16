/**************************************************
 * MAIN.JS
 * Punto de entrada - ShopUniverses
 **************************************************/
import {
    cargarInventario,
    getInventario,
} from "./data.js";

import {
    inicializarCarrito,
    getItemsCarrito
} from "./carrito.js";

(async function iniciarApp() {
    await cargarInventario();
    inicializarCarrito();

    console.log("✔ App inicializada");
    console.log("Inventario:", getInventario());
    console.log("Carrito:", getItemsCarrito());
})();

/**************************************************
 * NAV MOBILE & NAVEGACIÓN PRINCIPAL
 **************************************************/
function initNavigation() {
    const navToggle = document.getElementById("nav-toggle");
    const navLinks = document.querySelectorAll(".nav-links a");

    if (navToggle) {
        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                navToggle.checked = false;
            });
        });
    }

    document.getElementById("btnIrSpin")?.addEventListener("click", () => {
        window.location.href = "/spin";
    });

    document.getElementById("btnIrCatalogo")?.addEventListener("click", () => {
        window.location.href = "/catalogo";
    });

    initAdminAccess();
    initCookieBanner();
    initPqrsForm();
}

function initCookieBanner() {
    const banner = document.getElementById("cookie-banner");
    const acceptBtn = document.getElementById("btn-cookies-accept");
    const essentialBtn = document.getElementById("btn-cookies-essential");
    if (!banner) return;

    const STORAGE_KEY = "su_cookie_consent";
    if (!localStorage.getItem(STORAGE_KEY)) {
        banner.style.display = "block";
    }

    const saveChoice = (mode) => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ mode, acceptedAt: new Date().toISOString() })
        );
        banner.style.display = "none";
    };

    acceptBtn?.addEventListener("click", () => saveChoice("all"));
    essentialBtn?.addEventListener("click", () => saveChoice("essential"));
}

function initAdminAccess() {
    const modal = document.getElementById("admin-secret-modal");
    const openBtn = document.getElementById("btn-admin-secret");
    const closeBtn = document.getElementById("btn-close-admin-modal");
    if (!modal) return;

    const open = () => {
        modal.style.display = "flex";
        modal.querySelector('input[name="email"]')?.focus();
    };
    const close = () => {
        modal.style.display = "none";
    };

    openBtn?.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) close();
    });

    modal.querySelectorAll("[data-toggle-password]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-toggle-password");
            const input = targetId ? document.getElementById(targetId) : null;
            if (!input) return;
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            btn.textContent = isPassword ? "Ocultar" : "Ver";
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === "A") {
            e.preventDefault();
            if (modal.style.display === "flex") close();
            else open();
        } else if (e.key === "Escape" && modal.style.display === "flex") {
            close();
        }
    });
}

function initPqrsForm() {
    const form = document.getElementById("pqrs-form");
    const resultEl = document.getElementById("pqrs-result");
    const submitBtn = document.getElementById("btn-submit-pqrs");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (resultEl) {
            resultEl.style.display = "none";
            resultEl.textContent = "";
        }

        const accept = document.getElementById("pqrs-accept");
        if (accept && !accept.checked) {
            if (resultEl) {
                resultEl.style.display = "block";
                resultEl.style.background = "rgba(255,76,76,0.18)";
                resultEl.style.border = "1px solid #ff4c4c";
                resultEl.textContent = "Debes aceptar la Política de Tratamiento de Información.";
            }
            return;
        }

        if (submitBtn) submitBtn.disabled = true;
        try {
            const res = await fetch("/api/pqrs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: form.type.value,
                    orderCode: form.orderCode.value,
                    name: form.name.value,
                    email: form.email.value,
                    phone: form.phone.value,
                    document: form.document.value,
                    reason: form.reason.value,
                    details: form.details.value,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Error al radicar solicitud");

            if (resultEl) {
                resultEl.style.display = "block";
                resultEl.style.background = "rgba(61,214,208,0.15)";
                resultEl.style.border = "1px solid var(--color-accent)";
                resultEl.textContent = `✔ Solicitud radicada con éxito. Tu número de radicado es: ${data.claim.radicado}`;
            }
            form.reset();
        } catch (err) {
            if (resultEl) {
                resultEl.style.display = "block";
                resultEl.style.background = "rgba(255,76,76,0.18)";
                resultEl.style.border = "1px solid #ff4c4c";
                resultEl.textContent = "✖ " + err.message;
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavigation);
} else {
    initNavigation();
}
