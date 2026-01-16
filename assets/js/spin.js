// ==========================================
// SPIN.JS — ShopUniverses (Pulido Final)
// ==========================================

// ---------- ESTADO GLOBAL ----------
const SPIN_STATE = {
    currentMode: 'estandar',
    lastCompletedMode: null, // 'estandar' | 'premium'
    estandar: {
        maxGiros: 5,
        girosRestantes: 5,
        premiosTemporales: [],
        completed: false
    },
    premium: {
        maxGiros: 1,
        girosRestantes: 1,
        premiosTemporales: [],
        completed: false
    },
    currentRotation: 0,
    isSpinning: false
};

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
    const interval = setInterval(() => {
        const inv = getInventario();
        if (inv && Array.isArray(inv.productos)) {
            clearInterval(interval);
            drawWheel(SPIN_STATE.currentMode);
            updateUI();
        }
    }, );
});

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

    SPIN_STATE.currentMode = mode;

    document.querySelectorAll('.spin-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const canvas = document.getElementById('wheelCanvas');
    if (canvas) {
        const angle = SPIN_STATE.currentRotation % 360;
        canvas.style.transition = 'none';
        canvas.style.transform = `rotate(${angle}deg)`;
        void canvas.offsetWidth; // force reflow
        canvas.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
    }

    drawWheel(mode);
    updateUI();
}

// ---------- DATOS ----------
function getProductosDisponibles(mode) {
    const data = getInventario();

    // CLAVE: los productos están en data.productos
    if (!data || !Array.isArray(data.productos)) return [];

    return data.productos.filter(p => {
        const flag = mode === 'estandar'
            ? p.flags?.spin_estandar
            : p.flags?.spin_premium;

        return flag && p.stock > 0;
    });
}


// ---------- DIBUJO ----------
function drawWheel(mode) {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const productos = getProductosDisponibles(mode);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (productos.length === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Sin stock', canvas.width / 2, canvas.height / 2);
        return;
    }

    const center = canvas.width / 2;
    const radius = canvas.width / 2 - 10;
    const step = (2 * Math.PI) / productos.length;

    const colors = ['#6b3fa0', '#3dd6d0', '#2a1b4e', '#FFD700', '#FF4C4C'];

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
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';

        const name = prod.nombre.length > 18
            ? prod.nombre.slice(0, 18) + '…'
            : prod.nombre;

        ctx.fillText(name, radius - 20, 5);
        ctx.restore();
    });
}

// ---------- GIRO ----------
function spinWheel() {
    if (SPIN_STATE.isSpinning) return;

    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];
    const productos = getProductosDisponibles(mode);

    if (productos.length === 0) return;

    SPIN_STATE.isSpinning = true;
    updateStatus('🎲 Girando...');

    const winner = seleccionarProductoPonderado(productos);
    const segmentAngle = 360 / productos.length;
    const index = productos.findIndex(p => p.id === winner.id);

    const randomOffset = Math.random() * (segmentAngle - 10) + 5;
    const target = (360 - index * segmentAngle) + 270 - randomOffset;

    const spinAngle =
        SPIN_STATE.currentRotation +
        360 * 5 +
        (target - (SPIN_STATE.currentRotation % 360));

    const canvas = document.getElementById('wheelCanvas');
    canvas.style.transform = `rotate(${spinAngle}deg)`;

    SPIN_STATE.currentRotation = spinAngle;

    setTimeout(() => {
        SPIN_STATE.isSpinning = false;
        finalizeSpin(winner);
    }, 4000);
}

// ---------- SELECCIÓN ----------
function seleccionarProductoPonderado(productos) {
    const total = productos.reduce((s, p) => s + (p.peso_spin || 1), 0);
    let r = Math.random() * total;

    for (const p of productos) {
        r -= p.peso_spin || 1;
        if (r <= 0) return p;
    }
    return productos[0];
}

// ---------- FINALIZAR ----------
function finalizeSpin(producto) {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];

    session.premiosTemporales.push({
        ...producto,
        premium: mode === 'premium'
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
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];

    document.getElementById('panelTitle').textContent =
        `Ruleta ${mode === 'estandar' ? 'Estándar' : 'Premium'}`;

    document.getElementById('girosCounter').textContent =
        session.girosRestantes;

    const btn = document.getElementById('btnSpinAction');
    if (!btn) return;

    if (session.girosRestantes > 0 && !SPIN_STATE.isSpinning) {
        btn.textContent = 'Girar';
        btn.dataset.state = 'ready';
        btn.disabled = false;
    } else {
        btn.textContent = 'Sesión completada';
        btn.dataset.state = 'idle';
        btn.disabled = true;
    }

    renderPremios();
}

function renderPremios() {
    const ul = document.getElementById('listaPremiosTemporales');
    if (!ul) return;

    ul.innerHTML = '';

    const all = [
        ...SPIN_STATE.estandar.premiosTemporales,
        ...SPIN_STATE.premium.premiosTemporales
    ];

    if (all.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Aún no has girado</li>';
        return;
    }

    all.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.nombre;
        if (p.premium) li.classList.add('premium');
        ul.appendChild(li);
    });
}

function updateStatus(msg) {
    const el = document.getElementById('spinStatus');
    if (el) el.textContent = msg;
}

function openModal() {
    const modal = document.getElementById('modalPremios');
    const ul = document.getElementById('modalListaPremios');
    if (!modal || !ul) return;

    const mode = SPIN_STATE.lastCompletedMode;
    if (!mode) return; 
    
    ul.innerHTML = '';

    const premios = SPIN_STATE[mode].premiosTemporales;


    premios.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.nombre;
        if (p.premium) li.classList.add('premium');
        ul.appendChild(li);
    });

    modal.classList.add('is-open');
}

function toggleLista() {
    const cont = document.getElementById('lista-productos');
    if (!cont) return;

    const mode = SPIN_STATE.currentMode;
    const productos = getProductosDisponibles(mode);

    cont.innerHTML = '';

    if (productos.length === 0) {
        cont.innerHTML = '<li class="empty-msg">Sin productos disponibles</li>';
    } else {
        productos.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${p.nombre}</span>
                <small>Stock: ${p.stock}</small>
            `;
            cont.appendChild(li);
        });
    }

    if (cont.classList.contains('is-hidden')) {
    cont.classList.remove('is-hidden');
} else {
    cont.classList.add('is-hidden');
}
}

function closeModal() {
    const modal = document.getElementById('modalPremios');
    if (modal) {
        modal.classList.remove('is-open');
    }
}

function resetActualMode() {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];

    session.girosRestantes = session.maxGiros;
    session.premiosTemporales = [];
    session.completed = false;

    SPIN_STATE.isSpinning = false;

    updateStatus('🔄 Puedes girar de nuevo');
    updateUI();
    drawWheel(mode);

    closeModal();
}


function aceptarPremios() {
    const mode = SPIN_STATE.lastCompletedMode;
    const session = SPIN_STATE[mode];

    if (!session || session.premiosTemporales.length === 0) {
        closeModal();
        return;
    }

    // Agregar paquete Spin
    if (mode === "estandar") {
        agregarSpinBase();
    } else {
        agregarSpinPremium();
    }

    // Agregar productos reales
    session.premiosTemporales.forEach(p => {
        agregarProductoDesdeSpin({
        id: p.id,
        nombre: p.nombre
        });
        descontarStock(p.id);
    });

    // Limpiar estado
    session.premiosTemporales = [];
    session.completed = true;
    SPIN_STATE.isSpinning = false;
    SPIN_STATE.lastCompletedMode = null;

    updateStatus("✅ Premios agregados al carrito");
    updateUI();

    // Refrescar ruleta y lista tras actualizar inventario
    drawWheel(SPIN_STATE.currentMode);

    const lista = document.getElementById('lista-productos');
    if (lista && !lista.classList.contains('is-hidden')) {
        toggleLista(); // cierra
        toggleLista(); // vuelve a abrir con stock actualizado
    }

    closeModal();
}
