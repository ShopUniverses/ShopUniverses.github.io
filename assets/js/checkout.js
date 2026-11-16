/**************************************************
 * CHECKOUT.JS — Flujo de Checkout, Cupones y Wompi
 **************************************************/
import {
  cargarInventario,
  getInventario,
  validarCuponAPI,
  crearOrdenAPI,
} from "./data.js";

import { inicializarCarrito, getItemsCarrito } from "./carrito.js";

const CARRITO_KEY = "shopuniverses_carrito";

let appliedCoupon = null;
let currentSubtotal = 0;

function fmtCOP(n) {
  return "$ " + (Number(n) || 0).toLocaleString("es-CO");
}

function showAlert(msg) {
  const el = document.getElementById("checkout-alert");
  if (!el) return;
  if (!msg) {
    el.style.display = "none";
    el.textContent = "";
  } else {
    el.style.display = "block";
    el.textContent = msg;
  }
}

function resolveUnitPrice(item, inv) {
  const flash = inv?.flashSale;
  const applyFlash = (base) => {
    const pct = Number(flash?.percent) || 0;
    if (flash?.active && pct > 0 && pct <= 90) {
      return Math.round((Number(base) * (100 - pct)) / 100);
    }
    return Number(base) || 0;
  };

  if (item.tipo === "producto" && item.origen === "spin") return 0;
  if (item.tipo === "spin_base") return applyFlash(inv?.config?.spin?.precio_base || item.precio);
  if (item.tipo === "spin_premium") return applyFlash(inv?.config?.spin?.premium_precio || item.precio);

  const prod = inv?.productos?.find((p) => p.id === item.id);
  return prod ? Number(prod.precio_referencia) || 0 : Number(item.precio) || 0;
}

function renderSummary() {
  const items = getItemsCarrito();
  const inv = getInventario();
  const listEl = document.getElementById("checkout-lines");
  const payBtn = document.getElementById("pay-btn");

  if (!listEl) return;
  listEl.innerHTML = "";

  if (items.length === 0) {
    listEl.innerHTML = '<li style="color:var(--color-text-muted); padding:10px 0;">Tu carrito está vacío.</li>';
    currentSubtotal = 0;
    if (payBtn) payBtn.disabled = true;
  } else {
    let subtotal = 0;
    items.forEach((it) => {
      const price = resolveUnitPrice(it, inv);
      const qty = Number(it.qty) || 1;
      subtotal += price * qty;

      const li = document.createElement("li");
      li.className = "flex-between";
      li.style.padding = "8px 0";
      li.style.borderBottom = "1px solid var(--color-border)";
      const nameSpan = document.createElement("span");
      nameSpan.textContent = qty > 1 ? `${it.nombre} (x${qty})` : it.nombre;
      const priceSpan = document.createElement("strong");
      priceSpan.textContent = fmtCOP(price * qty);
      li.appendChild(nameSpan);
      li.appendChild(priceSpan);
      listEl.appendChild(li);
    });
    currentSubtotal = subtotal;
    if (payBtn) payBtn.disabled = false;
  }

  let discount = 0;
  const rowDiscount = document.getElementById("row-discount");
  if (appliedCoupon && currentSubtotal > 0) {
    discount =
      appliedCoupon.type === "percent"
        ? Math.min(currentSubtotal, Math.round((currentSubtotal * appliedCoupon.value) / 100))
        : Math.min(currentSubtotal, Math.round(appliedCoupon.value));
    if (rowDiscount) rowDiscount.style.display = "flex";
    document.getElementById("discount-code").textContent = appliedCoupon.code;
    document.getElementById("sum-discount").textContent = "- " + fmtCOP(discount);
  } else if (rowDiscount) {
    rowDiscount.style.display = "none";
  }

  const net = Math.max(0, currentSubtotal - discount);
  const shipCfg = inv?.shipping || { flat: 12000, freeMin: 100000 };
  const freeMin = Number(shipCfg.freeMin) || 0;
  const shipping = net <= 0 ? 0 : freeMin > 0 && net >= freeMin ? 0 : Number(shipCfg.flat) || 0;
  const total = net + shipping;

  document.getElementById("sum-subtotal").textContent = fmtCOP(currentSubtotal);
  document.getElementById("sum-shipping").textContent = shipping === 0 && net > 0 ? "Gratis" : fmtCOP(shipping);
  document.getElementById("sum-total").textContent = fmtCOP(total);

  const freeEl = document.getElementById("sum-free");
  if (freeEl) {
    if (freeMin > 0 && net > 0 && net < freeMin) {
      freeEl.style.display = "block";
      freeEl.textContent = `Te faltan ${fmtCOP(freeMin - net)} para envío gratis.`;
    } else {
      freeEl.style.display = "none";
    }
  }
}

async function handleApplyCoupon() {
  const input = document.getElementById("coupon-input");
  const msgEl = document.getElementById("coupon-msg");
  const code = String(input?.value || "").trim();

  if (!code) {
    appliedCoupon = null;
    if (msgEl) msgEl.textContent = "";
    renderSummary();
    return;
  }

  try {
    const res = await validarCuponAPI(code, currentSubtotal);
    appliedCoupon = res;
    if (msgEl) {
      msgEl.style.color = "var(--color-accent)";
      msgEl.textContent = `✔ Cupón ${res.code} aplicado (${res.remainingUses} usos disponibles).`;
    }
    renderSummary();
  } catch (err) {
    appliedCoupon = null;
    if (msgEl) {
      msgEl.style.color = "#ff7a7a";
      msgEl.textContent = "✖ " + (err.message || "Cupón inválido");
    }
    renderSummary();
  }
}

async function handleSubmitOrder(e) {
  e.preventDefault();
  showAlert("");

  const items = getItemsCarrito();
  if (items.length === 0) {
    showAlert("Tu carrito está vacío.");
    return;
  }

  const form = e.currentTarget;
  const acceptTerms = Boolean(document.getElementById("accept-terms")?.checked);
  if (!acceptTerms) {
    showAlert("Debes aceptar la Política de Tratamiento de Información y los Términos y Condiciones.");
    return;
  }

  const paymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value || "manual";
  const payBtn = document.getElementById("pay-btn");
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = "Procesando orden...";
  }

  try {
    const payload = {
      paymentMethod,
      couponCode: appliedCoupon?.code || null,
      items,
      customer: {
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
        document: form.document.value,
        department: form.department.value,
        city: form.city.value,
        address: form.address.value,
        notes: form.notes.value,
        acceptTerms,
        acceptMarketing: Boolean(document.getElementById("accept-marketing")?.checked),
      },
    };

    const res = await crearOrdenAPI(payload);
    localStorage.removeItem(CARRITO_KEY);

    if (res.wompi?.checkoutUrl) {
      window.location.href = res.wompi.checkoutUrl;
    } else {
      window.location.href = `/pedido/${encodeURIComponent(res.order.code)}`;
    }
  } catch (err) {
    showAlert(err.message || "No se pudo crear el pedido. Revisa los campos e intenta de nuevo.");
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "Confirmar pedido";
    }
  }
}

async function initCheckout() {
  if (!document.getElementById("checkout-form")) return;

  await cargarInventario();
  inicializarCarrito();
  renderSummary();

  document.getElementById("btn-apply-coupon")?.addEventListener("click", handleApplyCoupon);
  document.getElementById("checkout-form")?.addEventListener("submit", handleSubmitOrder);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCheckout);
} else {
  initCheckout();
}
