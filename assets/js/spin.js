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

function iniciarSpin() {
  const config = getConfigSpin();

  spinState = {
    activo: true,
    precio: config.precio_base,
    productosObjetivo: config.productos_por_spin,
    productosGanados: [],
    girosRestantes: config.productos_por_spin,
    premiumOfrecido: false,
    premiumAceptado: false
  };

  guardarSpinState();
}

/**
 * Carga el estado del spin si existe
 */
function cargarSpinState() {
  const saved = localStorage.getItem(SPIN_STATE_KEY);

  if (saved) {
    spinState = JSON.parse(saved);
  }
}

/**
 * Guarda el estado del spin
 */
function guardarSpinState() {
  localStorage.setItem(
    SPIN_STATE_KEY,
    JSON.stringify(spinState)
  );
}

/**************************************************
 * GIRO
 **************************************************/

function puedeGirar() {
  return (
    spinState &&
    spinState.activo &&
    spinState.girosRestantes > 0
  );
}

/**
 * Ejecuta un giro estándar
 */
function girarSpinEstandar() {
  if (!puedeGirar()) return null;

  // 🔄 recalcular productos disponibles ANTES del giro
  const disponibles = getProductosSpinEstandar();

  if (disponibles.length === 0) {
    return null;
  }

  const ganador = seleccionarProductoPonderado(disponibles);

  if (!ganador) return null;

  // Descontar stock
  descontarStock(ganador.id);

  // Registrar producto ganado
  spinState.productosGanados.push({
    id: ganador.id,
    nombre: ganador.nombre
  });

  spinState.girosRestantes--;
  guardarSpinState();

  return ganador;
}

/**************************************************
 * PREMIUM
 **************************************************/

function puedeOfrecerPremium() {
  return (
    spinState &&
    spinState.girosRestantes === 0 &&
    !spinState.premiumOfrecido
  );
}

function aceptarSpinPremium() {
  if (!puedeOfrecerPremium()) return null;

  const disponibles = getProductosSpinPremium();
  if (disponibles.length === 0) return null;

  const ganador = seleccionarProductoPonderado(disponibles);
  if (!ganador) return null;

  descontarStock(ganador.id);

  spinState.productosGanados.push({
    id: ganador.id,
    nombre: ganador.nombre,
    premium: true
  });

  spinState.premiumOfrecido = true;
  spinState.premiumAceptado = true;

  guardarSpinState();

  return ganador;
}

/**************************************************
 * FINALIZACIÓN / CANCELACIÓN
 **************************************************/

function finalizarSpin() {
  if (!spinState) return;

  spinState.activo = false;
  guardarSpinState();
}

function cancelarSpin() {
  if (!spinState) return;

  // Restaurar stock
  const ids = spinState.productosGanados.map(p => p.id);
  restaurarStock(ids);

  localStorage.removeItem(SPIN_STATE_KEY);
  spinState = null;
}

/**************************************************
 * CONSULTAS
 **************************************************/

function getSpinState() {
  return spinState;
}

function spinCompletado() {
  return spinState && spinState.girosRestantes === 0;
}
