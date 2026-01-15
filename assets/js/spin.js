/**************************************************
 * SPIN.JS
 * Lógica del Spin Wheel - ShopUniverses
 **************************************************/

const SPIN_STATE_KEY = "shopuniverses_spin_state";
let spinState = null;

/**************************************************
 * INICIALIZACIÓN
 **************************************************/

function iniciarSpin() {
  const config = getConfigSpin();

  spinState = {
    activo: true,
    precio: config.precio_base,

    girosRestantes: config.productos_por_spin,
    girosPremium: 0,

    productosGanados: [],
    premiosPendientes: []
  };

  guardarSpinState();
}

function cargarSpinState() {
  const saved = localStorage.getItem(SPIN_STATE_KEY);
  if (saved) spinState = JSON.parse(saved);
}

function guardarSpinState() {
  localStorage.setItem(SPIN_STATE_KEY, JSON.stringify(spinState));
}

function limpiarSpinState() {
  localStorage.removeItem(SPIN_STATE_KEY);
  spinState = null;
}

/**************************************************
 * VALIDACIONES
 **************************************************/

function haySpinActivo() {
  return spinState && spinState.activo;
}

function puedeGirarEstandar() {
  return haySpinActivo() && spinState.girosRestantes > 0;
}

function puedeOfrecerPremium() {
  return haySpinActivo() && spinState.girosRestantes === 0 && spinState.girosPremium === 0;
}

function puedeGirarPremium() {
  return haySpinActivo() && spinState.girosPremium > 0;
}

/**************************************************
 * GIRO ESTÁNDAR
 **************************************************/

function girarSpinEstandar() {
  if (!puedeGirarEstandar()) return null;

  const disponibles = getProductosSpinEstandar();
  if (!disponibles.length) return null;

  const ganador = seleccionarProductoPonderado(disponibles);

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
 * PREMIUM
 **************************************************/

function habilitarPremium() {
  if (!puedeOfrecerPremium()) return false;

  spinState.girosPremium = 1;
  guardarSpinState();
  return true;
}

function girarSpinPremiumUnico() {
  if (!puedeGirarPremium()) return null;

  const disponibles = getProductosSpinPremium();
  if (!disponibles.length) return null;

  const ganador = seleccionarProductoPonderado(disponibles);

  spinState.premiosPendientes.push({
    id: ganador.id,
    nombre: ganador.nombre,
    premium: true
  });

  spinState.girosPremium = 0;
  guardarSpinState();

  return ganador;
}

/**************************************************
 * PREMIOS
 **************************************************/

function aceptarPremios() {
  if (!spinState || !spinState.premiosPendientes.length) return;

  spinState.premiosPendientes.forEach(p => {
    descontarStock(p.id);
    agregarProductoCatalogoPorId(p.id);
    spinState.productosGanados.push(p);
  });

  spinState.premiosPendientes = [];
  guardarSpinState();
}

/**************************************************
 * CANCELACIÓN
 **************************************************/

function cancelarSpin() {
  if (!spinState) return;

  const ids = spinState.productosGanados.map(p => p.id);
  restaurarStock(ids);

  limpiarSpinState();
}

/**************************************************
 * CONSULTA
 **************************************************/

function getSpinState() {
  return spinState;
}

/**************************************************
 * PUENTES PARA UI (HTML)
 * Mantienen compatibilidad sin ensuciar lógica
 **************************************************/

function iniciarEstandar() {
  if (!haySpinActivo()) {
    iniciarSpin();
  }
}

function girarEstandar() {
  const ganador = girarSpinEstandar();
  if (ganador) {
    mostrarModalPremios();
  }
}

function iniciarPremium() {
  const ok = habilitarPremium();
  if (!ok) {
    console.warn("⚠️ Premium no disponible aún");
  }
}

function girarPremium() {
  const ganador = girarSpinPremiumUnico();
  if (ganador) {
    mostrarModalPremios();
  }
}
