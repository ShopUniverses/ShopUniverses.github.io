// ==========================================
// SPIN.JS — ShopUniverses (Servidor Seguro)
// ==========================================

import {
  cargarInventario,
  getInventario,
  obtenerStock,
  refrescarStock,
  girarRuletaAPI,
  aceptarRuletaAPI,
  getProductosSpinEstandar,
  getProductosSpinPremium,
  onStockChange,
} from "./data.js";

import { agregarPaqueteSpinConfirmado } from "./carrito.js";

// ---------- ESTADO GLOBAL ----------
const SPIN_STATE = {
  currentMode: "estandar",
  lastCompletedMode: null, // 'estandar' | 'premium'
  estandar: {
    maxGiros: 5,
    girosRestantes: 5,
    premiosTemporales: [],
    serverPrizes: [],
    spinToken: null,
    completed: false,
  },
  premium: {
    maxGiros: 1,
    girosRestantes: 1,
    premiosTemporales: [],
    serverPrizes: [],
    spinToken: null,
    completed: false,
  },
  currentRotation: 0,
  isSpinning: false,
};

let _initialized = false;

// ---------- INIT ----------
async function initSpin() {
  if (_initialized) return;

  // Solo estamos en spin.html si existe el canvas o el botón principal
  const btn = document.getElementById("btnSpinAction");
  const canvas = document.getElementById("wheelCanvas");
  if (!btn && !canvas) return;

  _initialized = true;

  try {
    await cargarInventario();
  } catch (err) {
    updateStatus("❌ Error cargando catálogo: " + err.message);
    return;
  }

  const inv = getInventario();
  if (inv?.config?.spin?.productos_por_spin) {
    const max = Number(inv.config.spin.productos_por_spin) || 5;
    SPIN_STATE.estandar.maxGiros = max;
    if (!SPIN_STATE.estandar.spinToken && !SPIN_STATE.estandar.completed) {
      SPIN_STATE.estandar.girosRestantes = max;
    }
  }

  if (btn) btn.addEventListener("click", handleSpinAction);

  document.querySelectorAll(".spin-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  document.getElementById("btnToggleLista")?.addEventListener("click", toggleLista);
  document.getElementById("btnResetSpin")?.addEventListener("click", resetActualMode);
  document.getElementById("btnAcceptSpin")?.addEventListener("click", aceptarPremios);

  drawWheel(SPIN_STATE.currentMode);
  updateUI();

  onStockChange(() => {
    if (SPIN_STATE.isSpinning) return;
    drawWheel(SPIN_STATE.currentMode);

    const lista = document.getElementById("lista-productos");
    if (lista && !lista.classList.contains("is-hidden")) {
      renderListaProductos();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSpin);
} else {
  initSpin();
}

// ---------- HANDLERS ----------
function handleSpinAction() {
  const mode = SPIN_STATE.currentMode;
  const session = SPIN_STATE[mode];

  if (SPIN_STATE.isSpinning) return;

  if (session.girosRestantes > 0 && !session.completed) {
    spinWheel();
  }
}

// ---------- CAMBIO DE MODO ----------
function switchMode(mode) {
  if (SPIN_STATE.isSpinning) return;
  if (mode !== "estandar" && mode !== "premium") return;

  SPIN_STATE.currentMode = mode;

  document.querySelectorAll(".spin-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  const canvas = document.getElementById("wheelCanvas");
  if (canvas) {
    const angle = SPIN_STATE.currentRotation % 360;
    canvas.style.transition = "none";
    canvas.style.transform = `rotate(${angle}deg)`;
    void canvas.offsetWidth;
    canvas.style.transition = "transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)";
  }

  drawWheel(mode);
  updateUI();
}

// ---------- DATOS ----------
function getProductosDisponibles(mode) {
  if (mode === "estandar") {
    return getProductosSpinEstandar();
  }
  return getProductosSpinPremium();
}

// ---------- DIBUJO ----------
function drawWheel(mode) {
  const canvas = document.getElementById("wheelCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const productos = getProductosDisponibles(mode);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (productos.length === 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Sin stock", canvas.width / 2, canvas.height / 2);
    return;
  }

  const center = canvas.width / 2;
  const radius = canvas.width / 2 - 10;
  const step = (2 * Math.PI) / productos.length;

  const colors = ["#6b3fa0", "#3dd6d0", "#2a1b4e", "#FFD700", "#FF4C4C"];

  productos.forEach((prod, i) => {
    const start = i * step;
    const end = start + step;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();

    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + step / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";

    const name = prod.nombre.length > 18 ? prod.nombre.slice(0, 18) + "…" : prod.nombre;
    ctx.fillText(name, radius - 20, 5);
    ctx.restore();
  });
}

// ---------- GIRO ----------
async function spinWheel() {
  if (SPIN_STATE.isSpinning) return;

  const mode = SPIN_STATE.currentMode;
  const session = SPIN_STATE[mode];
  const productos = getProductosDisponibles(mode);

  if (productos.length === 0) {
    updateStatus("⚠️ Sin productos disponibles para girar.");
    return;
  }

  SPIN_STATE.isSpinning = true;
  updateStatus("🎲 Girando...");
  updateUI();

  try {
    if (!session.spinToken) {
      const roll = await girarRuletaAPI(mode);
      session.spinToken = roll.spinToken;
      session.serverPrizes = roll.prizes || [];
    }
  } catch (err) {
    SPIN_STATE.isSpinning = false;
    updateStatus("❌ " + (err.message || "No se pudo iniciar la ruleta"));
    updateUI();
    return;
  }

  const prizeIndex = session.maxGiros - session.girosRestantes;
  const winner = session.serverPrizes[prizeIndex];
  if (!winner) {
    SPIN_STATE.isSpinning = false;
    updateStatus("❌ Sesión inválida. Reinicia la ruleta.");
    updateUI();
    return;
  }

  const segmentAngle = 360 / productos.length;
  const foundIndex = productos.findIndex((p) => p.id === winner.id);
  const index = foundIndex >= 0 ? foundIndex : 0;

  const randomOffset = Math.random() * Math.max(1, segmentAngle - 10) + 5;
  const target = 360 - index * segmentAngle + 270 - randomOffset;

  const spinAngle =
    SPIN_STATE.currentRotation +
    360 * 5 +
    (target - (SPIN_STATE.currentRotation % 360));

  const canvas = document.getElementById("wheelCanvas");
  if (canvas) {
    canvas.style.transform = `rotate(${spinAngle}deg)`;
  }

  SPIN_STATE.currentRotation = spinAngle;

  setTimeout(() => {
    SPIN_STATE.isSpinning = false;
    finalizeSpin(winner);
  }, 4000);
}

// ---------- FINALIZAR ----------
function finalizeSpin(producto) {
  const mode = SPIN_STATE.currentMode;
  const session = SPIN_STATE[mode];

  session.premiosTemporales.push({
    ...producto,
    premium: mode === "premium",
  });

  session.girosRestantes--;

  updateStatus(`🎁 Ganaste: ${producto.nombre}`);
  updateUI();

  if (session.girosRestantes === 0) {
    SPIN_STATE.lastCompletedMode = mode;
    setTimeout(openModal, 1800);
  }
}

// ---------- UI ----------
function updateUI() {
  const panelTitle = document.getElementById("panelTitle");
  const girosCounter = document.getElementById("girosCounter");
  const btn = document.getElementById("btnSpinAction");

  if (!panelTitle || !girosCounter || !btn) return;

  const mode = SPIN_STATE.currentMode;
  const session = SPIN_STATE[mode];

  panelTitle.textContent = `Ruleta ${mode === "estandar" ? "Estándar" : "Premium"}`;
  girosCounter.textContent = session.girosRestantes;

  if (SPIN_STATE.isSpinning) {
    btn.textContent = "Girando...";
    btn.disabled = true;
  } else if (session.girosRestantes > 0 && !session.completed) {
    btn.textContent = "Girar";
    btn.disabled = false;
  } else {
    btn.textContent = "Sesión completada";
    btn.disabled = true;
  }

  renderPremios();
}

function renderPremios() {
  const ul = document.getElementById("listaPremiosTemporales");
  if (!ul) return;

  ul.innerHTML = "";

  const all = [
    ...SPIN_STATE.estandar.premiosTemporales,
    ...SPIN_STATE.premium.premiosTemporales,
  ];

  if (all.length === 0) {
    ul.innerHTML = '<li class="empty-msg">Aún no has girado</li>';
    return;
  }

  all.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.nombre;
    if (p.premium) li.classList.add("premium");
    ul.appendChild(li);
  });
}

function updateStatus(msg) {
  const el = document.getElementById("spinStatus");
  if (el) el.textContent = msg;
}

function openModal() {
  const modal = document.getElementById("modalPremios");
  const ul = document.getElementById("modalListaPremios");
  if (!modal || !ul) return;

  const mode = SPIN_STATE.lastCompletedMode;
  if (!mode) return;

  ul.innerHTML = "";

  const premios = SPIN_STATE[mode].premiosTemporales;
  premios.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.nombre;
    if (p.premium) li.classList.add("premium");
    ul.appendChild(li);
  });

  modal.classList.add("is-open");
}

function renderListaProductos() {
  const cont = document.getElementById("lista-productos");
  if (!cont) return;

  const mode = SPIN_STATE.currentMode;
  const productos = getProductosDisponibles(mode);

  cont.innerHTML = "";

  if (productos.length === 0) {
    cont.innerHTML = '<li class="empty-msg">Sin productos disponibles</li>';
    return;
  }

  const stock = obtenerStock();
  productos.forEach((p) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = p.nombre;
    const small = document.createElement("small");
    small.textContent = `Stock: ${stock[p.id] ?? 0}`;
    li.appendChild(span);
    li.appendChild(small);
    cont.appendChild(li);
  });
}

function toggleLista() {
  const cont = document.getElementById("lista-productos");
  if (!cont) return;

  renderListaProductos();
  cont.classList.toggle("is-hidden");
}

function closeModal() {
  const modal = document.getElementById("modalPremios");
  if (modal) {
    modal.classList.remove("is-open");
  }
}

function resetActualMode() {
  const mode = SPIN_STATE.currentMode;
  const session = SPIN_STATE[mode];

  session.girosRestantes = session.maxGiros;
  session.premiosTemporales = [];
  session.serverPrizes = [];
  session.spinToken = null;
  session.completed = false;

  SPIN_STATE.isSpinning = false;
  SPIN_STATE.lastCompletedMode = null;

  updateStatus("🔄 Puedes girar de nuevo");
  updateUI();
  drawWheel(mode);

  closeModal();
}

async function aceptarPremios() {
  const mode = SPIN_STATE.lastCompletedMode;
  const session = SPIN_STATE[mode];

  if (!session || !session.spinToken || session.premiosTemporales.length === 0) {
    closeModal();
    return;
  }

  const acceptBtn = document.getElementById("btnAcceptSpin") || document.querySelector("#modalPremios .btn-accept");
  if (acceptBtn) acceptBtn.disabled = true;

  try {
    const confirmed = await aceptarRuletaAPI(session.spinToken);
    agregarPaqueteSpinConfirmado(confirmed);

    session.premiosTemporales = [];
    session.serverPrizes = [];
    session.spinToken = null;
    session.completed = true;
    SPIN_STATE.isSpinning = false;
    SPIN_STATE.lastCompletedMode = null;

    updateStatus("✅ Premios agregados al carrito");
    updateUI();
    drawWheel(SPIN_STATE.currentMode);

    const lista = document.getElementById("lista-productos");
    if (lista && !lista.classList.contains("is-hidden")) {
      renderListaProductos();
    }

    closeModal();
  } catch (err) {
    updateStatus("❌ " + (err.message || "Error al confirmar los premios"));
    session.spinToken = null;
    session.serverPrizes = [];
    session.premiosTemporales = [];
    session.girosRestantes = session.maxGiros;
    session.completed = false;
    SPIN_STATE.isSpinning = false;
    SPIN_STATE.lastCompletedMode = null;

    await refrescarStock().catch(() => {});
    drawWheel(SPIN_STATE.currentMode);
    updateUI();
    closeModal();
  } finally {
    if (acceptBtn) acceptBtn.disabled = false;
  }
}

// Exponer funciones para compatibilidad
window.switchMode = switchMode;
window.toggleLista = toggleLista;
window.aceptarPremios = aceptarPremios;
window.closeModal = closeModal;
window.resetActualMode = resetActualMode;
