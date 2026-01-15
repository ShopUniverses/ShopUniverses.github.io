// ==========================================
// SPIN.JS - Lógica del Juego
// ==========================================

// --- 1. DATOS (Inventario Simulado) ---
// En producción esto viene de data.js, pero lo incluyo aquí para funcionamiento autónomo.
const INVENTARIO = {
    "config": { 
        "spin": { 
            "precio_base": 25000, 
            "productos_por_spin": 5, 
            "premium_precio": 8000 
        } 
    },
    "productos": [
        { "id": "11-minas-bts", "nombre": "Lapíz 11 Minas de BTS", "precio_referencia": 3000, "stock": 3, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "11-minas-carita", "nombre": "Lapíz 11 Minas Carita", "precio_referencia": 3000, "stock": 4, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 2 },
        { "id": "atari-sapito", "nombre": "Atari Sapito", "precio_referencia": 5000, "stock": 3, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "blister-bts", "nombre": "Blister Borradores BTS", "precio_referencia": 10000, "stock": 4, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 2 },
        { "id": "bolsa-250ml", "nombre": "Bolsa térmica 250 ml", "precio_referencia": 10000, "stock": 1, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 1 },
        { "id": "bolsa-350ml", "nombre": "Bolsa térmica 350 ml", "precio_referencia": 15000, "stock": 3, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 1 },
        { "id": "borrador-aguacate", "nombre": "Borrador Aguacate", "precio_referencia": 2500, "stock": 1, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "capybara-post-it", "nombre": "Capybara Post-it", "precio_referencia": 4000, "stock": 3, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "carpeta-pandas", "nombre": "Carpeta Pandas", "precio_referencia": 3000, "stock": 15, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 3 },
        { "id": "carpeta-van-gogh", "nombre": "Carpeta Van Gogh", "precio_referencia": 5000, "stock": 6, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 2 },
        { "id": "degrade", "nombre": "Resaltador Degrade", "precio_referencia": 15000, "stock": 1, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 1 },
        { "id": "dinosaurio", "nombre": "Sacapuntas Dinosaurio", "precio_referencia": 5000, "stock": 1, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "hello-kitty", "nombre": "Hello Kitty Set", "precio_referencia": 6000, "stock": 3, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "lapiceros-flores", "nombre": "Lapiceros Flores", "precio_referencia": 3000, "stock": 92, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 9 },
        { "id": "lapiceros-stitch", "nombre": "Lapiceros Stitch", "precio_referencia": 2500, "stock": 1, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "lonchera-termica", "nombre": "Lonchera Térmica", "precio_referencia": 15000, "stock": 2, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 1 },
        { "id": "mina-infinita-kuromi", "nombre": "Mina Infinita Kuromi", "precio_referencia": 5000, "stock": 3, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "patica-x6", "nombre": "Resaltador Patica x6", "precio_referencia": 15000, "stock": 10, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 3 },
        { "id": "retractil", "nombre": "Borrador Retráctil", "precio_referencia": 7000, "stock": 24, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 4 },
        { "id": "rodillo", "nombre": "Rodillo x6 pcs", "precio_referencia": 12000, "stock": 2, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 1 },
        { "id": "sep-animalitos", "nombre": "Separador Animalitos", "precio_referencia": 5000, "stock": 2, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "sep-constelaciones", "nombre": "Separador Constelaciones", "precio_referencia": 5000, "stock": 1, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "sep-patica", "nombre": "Separador Patica", "precio_referencia": 5000, "stock": 2, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "set-marcadores", "nombre": "Marcadores Base Agua", "precio_referencia": 20000, "stock": 1, "flags": { "catalogo": true, "spin_estandar": false, "spin_premium": true }, "peso_spin": 1 },
        { "id": "sticker-cristal", "nombre": "Sticker Cristal", "precio_referencia": 5000, "stock": 1, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "sticker-snoopy", "nombre": "Sticker Snoopy", "precio_referencia": 4000, "stock": 2, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "tijeras-aguacate", "nombre": "Tijeras Aguacate", "precio_referencia": 6000, "stock": 3, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 },
        { "id": "tijeras-mario", "nombre": "Tijeras Mario", "precio_referencia": 6000, "stock": 1, "flags": { "catalogo": true, "spin_estandar": true, "spin_premium": false }, "peso_spin": 1 }
    ]
};

// --- 2. ESTADO GLOBAL ---
const SPIN_STATE = {
    currentMode: 'estandar', // 'estandar' | 'premium'
    estandar: {
        maxGiros: 5,
        girosRestantes: 5,
        premiosTemporales: [], // Productos ganados aún no aceptados
        completed: false
    },
    premium: {
        maxGiros: 1,
        girosRestantes: 1,
        premiosTemporales: [],
        completed: false
    },
    // Variables de animación
    currentRotation: 0,
    isSpinning: false
};

// --- 3. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {

  drawWheel(SPIN_STATE.currentMode);
  updateUI();

  document
    .getElementById('btnSpinAction')
    .addEventListener('click', handleSpinAction);

});

// --- 4. LÓGICA DE UI Y CONTROL ---

// Cambiar entre Ruleta Estándar y Premium
function switchMode(mode) {
    if (SPIN_STATE.isSpinning) return; // Bloquear cambio si gira

    SPIN_STATE.currentMode = mode;
    
    // Actualizar pestañas
    document.querySelectorAll('.spin-tab').forEach(btn => {
        btn.classList.remove('active');
        if(btn.dataset.mode === mode) btn.classList.add('active');
    });

    // Resetear rotación visual para que no salte bruscamente
    const canvas = document.getElementById('wheelCanvas');
    // Calculamos el equivalente de la rotación actual modulo 360 para empezar suave
    const currentAngle = SPIN_STATE.currentRotation % 360;
    canvas.style.transition = 'none';
    canvas.style.transform = `rotate(${currentAngle}deg)`;
    
    // Redibujar ruleta con productos del modo seleccionado
    drawWheel(mode);
    
    updateUI();
}

// Acción principal del botón
document.getElementById('btnSpinAction').addEventListener('click', () => {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];

    // Si no ha iniciado (o está completado), iniciar/reiniciar
    if (session.girosRestantes === session.maxGiros && session.premiosTemporales.length === 0) {
        // Iniciar sesión
        session.premiosTemporales = [];
        session.completed = false;
        session.girosRestantes = session.maxGiros; // Asegurar conteo
        updateUI();
        return; // Esperar al siguiente clic para girar
    }

    // Si tiene giros, girar
    if (session.girosRestantes > 0 && !session.completed) {
        spinWheel();
    }
});

// --- 5. MOTOR DE FÍSICA Y DIBUJO ---

function getProductosDisponibles(mode) {
    return INVENTARIO.productos.filter(p => {
        const flagKey = mode === 'estandar' ? 'spin_estandar' : 'spin_premium';
        return p.flags[flagKey] && p.stock > 0;
    });
}

function drawWheel(mode) {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const productos = getProductosDisponibles(mode);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2;
    const step = (2 * Math.PI) / productos.length;
    
    // Paleta de colores basada en la marca
    const colors = ['#6b3fa0', '#3dd6d0', '#2a1b4e', '#FFD700', '#FF4C4C', '#ffffff'];
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar segmentos
    productos.forEach((prod, i) => {
        const startAngle = i * step;
        const endAngle = (i + 1) * step;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.stroke(); // Línea divisoria

        // Texto
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + step / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px Arial";
        // Truncar nombre si es muy largo
        const nombre = prod.nombre.length > 15 ? prod.nombre.substring(0, 15) + '...' : prod.nombre;
        ctx.fillText(nombre, radius - 20, 5);
        ctx.restore();
    });

    // Si no hay productos
    if (productos.length === 0) {
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Sin Stock", centerX, centerY);
    }
}

function spinWheel() {
    if (SPIN_STATE.isSpinning) return;
    
    const mode = SPIN_STATE.currentMode;
    const productos = getProductosDisponibles(mode);

    if (productos.length === 0) {
        document.getElementById('spinStatus').textContent = "⚠️ No hay productos disponibles";
        return;
    }

    SPIN_STATE.isSpinning = true;
    document.getElementById('btnSpinAction').dataset.state = "spinning";
    document.getElementById('spinStatus').textContent = "🎲 Girando...";

    // 1. Determinar ganador (Lógica de negocio)
    // Seleccionar producto ponderado
    const winner = seleccionarProductoPonderado(productos);
    
    // 2. Calcular ángulo de parada
    // El canvas empieza en 0 (3 en punto en círculo unitario, pero rotamos el canvas).
    // La flecha está arriba (270 grados o -90 grados).
    // Necesitamos que el segmento ganador termine en la flecha.
    
    const segmentAngle = 360 / productos.length;
    // Encontrar índice del ganador
    const winnerIndex = productos.findIndex(p => p.id === winner.id);
    
    // Ajuste matemático para que el segmento apunte a la flecha (Top - 90deg)
    // Rotamos canvas para alinear.
    // Añadir aleatoriedad dentro del segmento
    const randomOffset = Math.floor(Math.random() * (segmentAngle - 10)) + 5; 
    
    // Para que el item I quede arriba (270deg), rotamos: (360 - (I * angle)) + 270
    const targetRotation = (360 - (winnerIndex * segmentAngle)) + 270 - randomOffset;
    
    // Añadir vueltas completas para efecto (ej: 5 vueltas)
    const spinAngle = SPIN_STATE.currentRotation + (360 * 5) + (targetRotation - (SPIN_STATE.currentRotation % 360));

    // 3. Ejecutar Animación CSS
    const canvas = document.getElementById('wheelCanvas');
    canvas.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
    canvas.style.transform = `rotate(${spinAngle}deg)`;

    // Actualizar estado global de rotación
    SPIN_STATE.currentRotation = spinAngle;

    // 4. Finalizar giro
    setTimeout(() => {
        SPIN_STATE.isSpinning = false;
        finalizeSpin(winner);
    }, 4000);
}

function seleccionarProductoPonderado(productos) {
    // Ponderación simple basada en peso_spin
    let totalWeight = productos.reduce((sum, p) => sum + (p.peso_spin || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (let prod of productos) {
        if (random < (prod.peso_spin || 1)) return prod;
        random -= (prod.peso_spin || 1);
    }
    return productos[0]; // Fallback
}

function finalizeSpin(producto) {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];

    // Guardar premio temporal
    session.premiosTemporales.push({
        ...producto,
        premium: mode === 'premium'
    });

    session.girosRestantes--;
    
    document.getElementById('spinStatus').textContent = `¡Ganaste: ${producto.nombre}!`;
    
    updateUI();

    // Chequear si finaliza la sesión
    if (session.girosRestantes === 0) {
        setTimeout(() => openModal(), 1000);
    }
}

// --- 6. GESTIÓN DE UI ---

function updateUI() {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];
    const btn = document.getElementById('btnSpinAction');

    // Título y Contador
    document.getElementById('panelTitle').textContent = `Ruleta ${mode === 'estandar' ? 'Estándar' : 'Premium'}`;
    document.getElementById('girosCounter').textContent = session.girosRestantes;

    // Estado del Botón
    if (session.girosRestantes > 0 && session.premiosTemporales.length < session.maxGiros) {
        btn.textContent = "Girar";
        btn.dataset.state = "ready";
        btn.disabled = false;
    } else if (session.girosRestantes === 0 && session.premiosTemporales.length > 0) {
        btn.textContent = "Sesión Completada";
        btn.dataset.state = "idle";
        btn.disabled = true; // Obligar a usar el modal
    } else {
        // Estado inicial (o reset)
        btn.textContent = mode === 'estandar' ? "Iniciar Estándar ($25.000)" : "Iniciar Premium ($8.000)";
        btn.dataset.state = "ready";
        btn.disabled = false;
    }

    // Lista de premios temporales (Panel lateral)
    const ul = document.getElementById('listaPremiosTemporales');
    ul.innerHTML = '';
    
    // Combinar estándar y premium para ver todo lo ganado globalmente
    const allPrizes = [...SPIN_STATE.estandar.premiosTemporales, ...SPIN_STATE.premium.premiosTemporales];

    if (allPrizes.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Aún no has girado</li>';
    } else {
        allPrizes.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.nombre;
            if (p.premium) li.classList.add('premium');
            ul.appendChild(li);
        });
    }
}

// Toggle lista de posibles productos
function toggleLista() {
    const l = document.getElementById("lista-productos");
    l.classList.toggle("is-hidden");
    
    if (!l.classList.contains("is-hidden")) {
        renderPosibles();
    }
}

function renderPosibles() {
    const cont = document.getElementById("lista-productos");
    cont.innerHTML = "";
    
    // Usar el inventario global filtrado por el modo actual para mostrar lo que hay
    // Nota: Para simplicidad mostramos todos los que están disponibles para CUALQUIER spin
    const productos = INVENTARIO.productos.filter(p => (p.flags.spin_estandar || p.flags.spin_premium) && p.stock > 0);

    productos.forEach(p => {
        const div = document.createElement("div");
        div.className = "spin-list__item"; // Reutilizando estilos básicos
        div.style.padding = "5px";
        div.innerHTML = `
            <span>${p.nombre}</span>
            <small>Stock: ${p.stock}</small>
        `;
        cont.appendChild(div);
    });
}

// --- 7. MODAL Y FLUJOS FINALES ---

function openModal() {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];
    const modal = document.getElementById('modalPremios');
    const list = document.getElementById('modalListaPremios');
    const btnPremium = document.getElementById('btnGoPremium');
    const desc = document.getElementById('modalDescription');

    list.innerHTML = '';
    session.premiosTemporales.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.nombre;
        if (p.premium) li.classList.add('premium');
        list.appendChild(li);
    });

    // Lógica de botones del modal
    if (mode === 'estandar') {
        desc.textContent = "Has completado los 5 giros estándar.";
        btnPremium.style.display = 'block'; // Opción de ir a premium
    } else {
        desc.textContent = "Has completado el giro premium.";
        btnPremium.style.display = 'none'; // No se puede ir a premium desde premium
    }

    modal.classList.add('is-open');
}

// Cerrar modal (función helper)
function closeModal() {
    document.getElementById('modalPremios').classList.remove('is-open');
}

// Opción 1: Aceptar y Agregar al Carrito
window.aceptarPremios = function() {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];

    // 1. Agregar paquete al carrito (Simulación de carrito.js)
    const precioPaquete = mode === 'estandar' ? INVENTARIO.config.spin.precio_base : INVENTARIO.config.spin.premium_precio;
    const nombrePaquete = mode === 'estandar' ? "Spin ShopUniverses – Estándar" : "Spin ShopUniverses – Premium";
    
    console.log(`[CARRITO] Agregado: ${nombrePaquete} - $${precioPaquete}`);
    
    // 2. Agregar productos individuales ($0) y descontar stock REAL
    session.premiosTemporales.forEach(p => {
        // Descuento de inventario en el objeto JSON (En frontend real esto iría al backend)
        const prodRef = INVENTARIO.productos.find(x => x.id === p.id);
        if(prodRef && prodRef.stock > 0) {
            prodRef.stock--;
            console.log(`[STOCK] Descontado 1 unidad de ${p.nombre}. Quedan: ${prodRef.stock}`);
        }
        
        console.log(`[CARRITO] Agregado: ${p.nombre} - $0`);
    });

    // 3. Limpiar sesión
    session.premiosTemporales = [];
    session.completed = true;
    session.girosRestantes = 0; // Queda en 0 indicando terminado

    closeModal();
    updateUI();
    drawWheel(mode); // Redibujar por si cambió el stock
    
    // Notificación visual simple
    document.getElementById('spinStatus').textContent = "✅ Agregado al carrito con éxito";
};

// Opción 2: Volver a girar (Descartar premios actuales de ESTE modo)
window.resetActualMode = function() {
    const mode = SPIN_STATE.currentMode;
    const session = SPIN_STATE[mode];

    // Reiniciar contadores
    session.girosRestantes = session.maxGiros;
    session.premiosTemporales = [];
    session.completed = false;

    closeModal();
    updateUI();
    document.getElementById('spinStatus').textContent = "Sesión reiniciada. ¡Suerte!";
};

// Opción 3: Transición a Premium (Solo desde Estándar)
window.transitionToPremium = function() {
    closeModal();
    // Cambiar a modo premium manteniendo los premios estándar en memoria
    switchMode('premium');
    document.getElementById('spinStatus').textContent = "Ahora juega la Premium para completar tu pedido.";
};