const SPIN_KEY = "shopuniverses_spin_v2";

let spin = {
  estandar: { giros: 5, premios: [] },
  premium: { giros: 1, premios: [] },
  actual: null
};

function guardarSpin() {
  localStorage.setItem(SPIN_KEY, JSON.stringify(spin));
}

function cargarSpin() {
  const s = localStorage.getItem(SPIN_KEY);
  if (s) spin = JSON.parse(s);
}

function iniciar(tipo) {
  spin.actual = tipo;
  spin[tipo].giros = tipo === "estandar" ? 5 : 1;
  spin[tipo].premios = [];
  guardarSpin();
  actualizarUI();
}

function girar() {
  const tipo = spin.actual;
  if (!tipo || spin[tipo].giros <= 0) return;

  const prod = seleccionarProductoPonderado(
    tipo === "estandar"
      ? getProductosSpinEstandar()
      : getProductosSpinPremium()
  );

  spin[tipo].premios.push({ ...prod, premium: tipo === "premium" });
  spin[tipo].giros--;
  animar(tipo);
  guardarSpin();

  if (spin[tipo].giros === 0) mostrarModal();
  actualizarUI();
}

function aceptar() {
  const tipo = spin.actual;

  spin[tipo].premios.forEach(p => {
    descontarStock(p.id);
    agregarProductoDesdeSpin(p);
  });

  tipo === "estandar" ? agregarSpinBase() : agregarSpinPremium();
  spin.actual = null;
  guardarSpin();
  cerrarModal();
  actualizarUI();
}

function repetir() {
  iniciar(spin.actual);
  cerrarModal();
}

function animar(tipo) {
  const el = document.querySelector(
    tipo === "estandar"
      ? ".spin-wheel--standard"
      : ".spin-wheel--premium"
  );
  el.classList.add("is-spinning");
  setTimeout(() => el.classList.remove("is-spinning"), 1000);
}

/* ---------- UI ---------- */
function actualizarUI() {
  document.getElementById("girosEstandar").textContent = spin.estandar.giros;
  document.getElementById("girosPremium").textContent = spin.premium.giros;

  const ul = document.getElementById("productos");
  ul.innerHTML = "";

  [...spin.estandar.premios, ...spin.premium.premios].forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.nombre;
    if (p.premium) li.classList.add("premium");
    ul.appendChild(li);
  });
}

/* ---------- MODAL ---------- */
function mostrarModal() {
  const ul = document.getElementById("listaPendientes");
  ul.innerHTML = "";

  spin[spin.actual].premios.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.nombre;
    if (p.premium) li.classList.add("premium");
    ul.appendChild(li);
  });

  document.getElementById("modalPremios").classList.add("is-open");
}

function cerrarModal() {
  document.getElementById("modalPremios").classList.remove("is-open");
}

document.addEventListener("DOMContentLoaded", () => {
  cargarSpin();
  actualizarUI();
});
