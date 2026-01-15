/**************************************************
 * SPIN.JS
 * Lógica del Spin Wheel - ShopUniverses
 **************************************************/

const SPIN_STATE_KEY = "shopuniverses_spin_state";

/**
 * Estado del spin en memoria
 */
let spinState = null;

/**************************************************
 * INICIALIZACIÓN
 **************************************************/

function iniciarSpin(tipo = "estandar") {
  localStorage.removeItem(SPIN_STATE_KEY);

  const config = getConfigSpin();

  spinState = {
    activo: true,
    tipoActivo: tipo,                 // "estandar" | "premium"
    precio: tipo === "estandar" ? config.precio_base : 8000,

    girosRestantes: tipo === "estandar"
      ? config.productos_por_spin
      : 0,

    girosPremium: tipo === "premium" ? 1 : 0,

    productosGanados: [],             // aceptados
    premiosPendientes: []             // 👈 NUEVO (clave)
  };

  guardarSpinState();
}

function limpiarSpinState() {
  localStorage.removeItem(SPIN_STATE_KEY);
  spinState = null;
}

/**
 * Carga el estado del spin si existe
 */
function cargarSpinState() {
  const saved = localStorage.getItem(SPIN_STATE_KEY);
  if (saved) spinState = JSON.parse(saved);
}

/**
 * Guarda el estado del spin
 */
function guardarSpinState() {
  localStorage.setItem(SPIN_STATE_KEY, JSON.stringify(spinState));
}

/**************************************************
 * VALIDACIONES
 **************************************************/

function haySpinActivo() {
  return spinState && spinState.activo;
}

function puedeGirarEstandar() {
  return (
    spinState &&
    spinState.activo &&
    spinState.girosRestantes > 0
  );
}

function puedeGirarPremium() {
  return (
    spinState &&
    spinState.activo &&
    spinState.girosPremium > 0
  );
}

/**************************************************
 * GIRO ESTÁNDAR (NO descuenta stock)
 **************************************************/

function girarSpinEstandar() {
  if (!puedeGirarEstandar()) return null;

  const disponibles = getProductosSpinEstandar();
  if (disponibles.length === 0) return null;

  const ganador = seleccionarProductoPonderado(disponibles);
  if (!ganador) return null;

  spinState.premiosPendientes.push({
    id: ganador.id,
    nombre: ganador.nombre,
    premium: false
  });

  spinState.girosRestantes--;
  guardarSpinState();

  return ganador;
}

/**************************************************
 * GIRO PREMIUM (1 por inicio, NO descuenta stock)
 **************************************************/

function iniciarPremium() {
  if (!spinState) iniciarSpin("premium");

  spinState.girosPremium += 1;
  guardarSpinState();
}

function girarSpinPremiumUnico() {
  if (!puedeGirarPremium()) return null;

  const disponibles = getProductosSpinPremium();
  if (disponibles.length === 0) return null;

  const ganador = seleccionarProductoPonderado(disponibles);
  if (!ganador) return null;

  spinState.premiosPendientes.push({
    id: ganador.id,
    nombre: ganador.nombre,
    premium: true
  });

  spinState.girosPremium--;
  guardarSpinState();

  return ganador;
}

/**************************************************
 * ACEPTAR / CANCELAR PREMIOS
 **************************************************/

function aceptarPremios() {
  if (!spinState || spinState.premiosPendientes.length === 0) return;

  spinState.premiosPendientes.forEach(p => {
    // ✔ aquí SÍ se toca inventario y carrito
    descontarStock(p.id);
    agregarProductoCatalogoPorId(p.id);

    spinState.productosGanados.push(p);
  });

  spinState.premiosPendientes = [];
  guardarSpinState();
}

function descartarPremiosPendientes() {
  if (!spinState) return;
  spinState.premiosPendientes = [];
  guardarSpinState();
}

/**************************************************
 * CANCELACIÓN TOTAL
 **************************************************/

function cancelarSpin() {
  if (!spinState) return;

  // Restaurar SOLO productos aceptados
  const ids = spinState.productosGanados.map(p => p.id);
  restaurarStock(ids);

  limpiarSpinState();
}

/**************************************************
 * CONSULTAS
 **************************************************/

function getSpinState() {
  return spinState;
}
