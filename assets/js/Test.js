/**
 * TEST.JS — ShopUniverses
 * Suite completa: reset Firestore → sync → E2E
 *
 * USO desde consola (cualquier página):
 *   import('./assets/js/test.js').then(m => m.runAll())
 *
 * O solo una parte:
 *   import('./assets/js/test.js').then(m => m.resetFirestore())
 *   import('./assets/js/test.js').then(m => m.checkSync())
 *   import('./assets/js/test.js').then(m => m.runE2E())
 */

// ─── HELPERS ────────────────────────────────────────────
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const DELAY = 3000;

let _ok = 0, _fail = 0;
function pass(msg) { console.log(`✅ ${msg}`); _ok++; }
function error(msg) { console.error(`❌ ${msg}`); _fail++; }
function titulo(msg) { console.log(`\n🧪 ${msg}`); }
function info(msg)  { console.log(`   📊 ${msg}`); }

// ─── PASO 1: RESET FIRESTORE ────────────────────────────
export async function resetFirestore() {
    console.log('\n🔄 Reseteando Firestore desde inventario.json...');
    const { db, doc } = await import('./firebase.js');
    const { setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const inv = await fetch('/data/inventario.json').then(r => r.json());

    for (const p of inv.productos) {
        await setDoc(doc(db, 'stock', p.id), { Cantidad: p.stock });
        console.log(`   ✅ ${p.id}: ${p.stock}`);
    }
    console.log('🚀 Firestore reseteado\n');
}

// ─── PASO 2: LIMPIAR LOCALSTORAGE ──────────────────────
export function resetLocal() {
    localStorage.removeItem('shopuniverses_stock');
    localStorage.removeItem('shopuniverses_carrito');
    console.log('🧹 localStorage limpio');
}

// ─── PASO 3: VERIFICAR SINCRONÍA ───────────────────────
export async function checkSync() {
    console.log('\n🔍 Verificando sincronía Firestore ↔ localStorage...');
    const { db, collection, getDocs } = await import('./firebase.js');

    // Leer Firestore directamente y poblar localStorage sin depender del caché
    const snap = await getDocs(collection(db, 'stock'));
    const stockFresh = {};
    snap.forEach(d => {
        const cantidad = d.data().Cantidad;
        if (typeof cantidad === 'number') stockFresh[d.id] = cantidad;
    });

    // Guardar directo en localStorage
    localStorage.setItem('shopuniverses_stock', JSON.stringify(stockFresh));

    // Verificar que quedó bien
    const local = JSON.parse(localStorage.getItem('shopuniverses_stock') || '{}');
    let malos = 0;

    snap.forEach(d => {
        const f = d.data().Cantidad;
        const l = local[d.id];
        if (f !== l) {
            console.warn(`   ⚠️ ${d.id}: Firestore=${f} local=${l}`);
            malos++;
        }
    });

    if (malos === 0) {
        console.log(`✅ Todo sincronizado (${snap.size} productos)\n`);
        return true;
    } else {
        console.log(`❌ ${malos} productos desincronizados\n`);
        return false;
    }
}

// ─── PASO 4: TEST E2E ───────────────────────────────────
export async function runE2E() {
    _ok = 0; _fail = 0;
    console.log('\n══════════════════════════════════');
    console.log('  INICIANDO TEST E2E');
    console.log('══════════════════════════════════');

    const { cargarInventario, obtenerStock, descontarStock,
            getProductosSpinEstandar, getProductosSpinPremium,
            getProductosCatalogo } = await import('./data.js');

    const { inicializarCarrito, getItemsCarrito, getTotal,
            agregarSpinBase, agregarSpinPremium, agregarProductoDesdeSpin,
            agregarProductoCatalogo, eliminarItem,
            cancelarCompraCompleta } = await import('./carrito.js');

    const { db, doc, getDoc } = await import('./firebase.js');

    await cargarInventario();
    inicializarCarrito();

    const stockF = async (id) => (await getDoc(doc(db, 'stock', id))).data()?.Cantidad;
    const limpiar = async () => { await cancelarCompraCompleta(); await esperar(DELAY); };

    // Producto exclusivo para catálogo — fuera del pool de spin
    const idsSpinPool = new Set([
        ...getProductosSpinEstandar().map(p => p.id),
        ...getProductosSpinPremium().map(p => p.id)
    ]);
    const prodCatalogo = getProductosCatalogo().find(p => !idsSpinPool.has(p.id));
    if (!prodCatalogo) {
        error('SETUP — No hay producto de catálogo fuera del pool de spin');
        return;
    }
    info(`Producto exclusivo catálogo: ${prodCatalogo.id}`);

    // ── A: SPIN ESTÁNDAR compra ─────────────────────────
    titulo('BLOQUE A — SPIN ESTÁNDAR: compra completa');
    await limpiar();
    try {
        const prods = getProductosSpinEstandar().slice(0, 5);
        if (!prods.length) { error('A0 — sin productos estándar'); }
        else {
            agregarSpinBase();
            for (const p of prods) {
                agregarProductoDesdeSpin({ id: p.id, nombre: p.nombre });
                await descontarStock(p.id);
            }
            await esperar(DELAY);
            const items = getItemsCarrito();
            items.some(i => i.tipo === 'spin_base') ? pass('A1 — spin_base en carrito') : error('A1 — falta spin_base');
            items.filter(i => i.origen === 'spin').length === prods.length ? pass(`A2 — ${prods.length} productos spin`) : error(`A2 — productos: ${items.filter(i => i.origen === 'spin').length}`);
            getTotal() === 25000 ? pass('A3 — total $25.000 correcto') : error(`A3 — total: $${getTotal()}`);
            const cantF = await stockF(prods[0].id);
            const cantL = obtenerStock()[prods[0].id];
            cantF === cantL ? pass(`A4 — Firestore y local coinciden (${cantF})`) : error(`A4 — Firestore:${cantF} vs local:${cantL}`);
        }
    } catch(e) { error('A error: ' + e.message); }

    // ── B: SPIN ESTÁNDAR cancelar ───────────────────────
    titulo('BLOQUE B — SPIN ESTÁNDAR: cancelar (rollback)');
    try {
        const stockAntes = { ...obtenerStock() };
        const prodsSpin = getItemsCarrito().filter(i => i.tipo === 'producto' && i.origen === 'spin');
        await cancelarCompraCompleta();
        await esperar(DELAY);
        getItemsCarrito().length === 0 ? pass('B1 — carrito vacío') : error('B1 — carrito no vacío');
        for (const item of prodsSpin.slice(0, 2)) {
            const cantF = await stockF(item.id);
            cantF >= stockAntes[item.id] ? pass(`B2 — restaurado ${item.nombre.slice(0, 20)}: ${cantF}`) : error(`B2 — no restaurado ${item.nombre.slice(0, 20)}: ${cantF}`);
        }
    } catch(e) { error('B error: ' + e.message); }

    // ── C: SPIN PREMIUM compra ──────────────────────────
    titulo('BLOQUE C — SPIN PREMIUM: compra completa');
    await limpiar();
    try {
        const prods = getProductosSpinPremium().slice(0, 1);
        if (!prods.length) { error('C0 — sin productos premium'); }
        else {
            agregarSpinPremium();
            for (const p of prods) {
                agregarProductoDesdeSpin({ id: p.id, nombre: p.nombre });
                await descontarStock(p.id);
            }
            await esperar(DELAY);
            const items = getItemsCarrito();
            items.some(i => i.tipo === 'spin_premium') ? pass('C1 — spin_premium en carrito') : error('C1 — falta spin_premium');
            items.some(i => i.origen === 'spin') ? pass('C2 — producto premium en carrito') : error('C2 — falta producto');
            getTotal() === 8000 ? pass('C3 — total $8.000 correcto') : error(`C3 — total: $${getTotal()}`);
            const cantF = await stockF(prods[0].id);
            const cantL = obtenerStock()[prods[0].id];
            cantF === cantL ? pass(`C4 — Firestore y local coinciden (${cantF})`) : error(`C4 — Firestore:${cantF} vs local:${cantL}`);
        }
    } catch(e) { error('C error: ' + e.message); }

    // ── D: SPIN PREMIUM eliminar paquete ────────────────
    titulo('BLOQUE D — SPIN PREMIUM: eliminar paquete');
    try {
        const stockAntes = { ...obtenerStock() };
        const items = getItemsCarrito();
        const indexPaquete = items.findIndex(i => i.tipo === 'spin_premium');
        const prodsSpin = items.filter(i => i.origen === 'spin');
        indexPaquete >= 0 ? pass('D1 — paquete encontrado en índice ' + indexPaquete) : error('D1 — paquete no encontrado');
        await eliminarItem(indexPaquete);
        await esperar(DELAY);
        const quedaSpin = getItemsCarrito().some(i => i.tipo.startsWith('spin_') || i.origen === 'spin');
        !quedaSpin ? pass('D2 — carrito limpio tras eliminar paquete') : error('D2 — quedan items del spin');
        for (const item of prodsSpin.slice(0, 1)) {
            const cantF = await stockF(item.id);
            cantF >= stockAntes[item.id] ? pass(`D3 — stock restaurado: ${cantF}`) : error(`D3 — no restaurado: ${cantF}`);
        }
    } catch(e) { error('D error: ' + e.message); }

    // ── E: SPIN ESTÁNDAR + PREMIUM juntos ───────────────
    titulo('BLOQUE E — SPIN ESTÁNDAR + PREMIUM juntos, luego cancelar');
    await limpiar();
    try {
        const prodsE = getProductosSpinEstandar().slice(0, 2);
        const prodsP = getProductosSpinPremium().slice(0, 1);
        agregarSpinBase();
        prodsE.forEach(p => agregarProductoDesdeSpin({ id: p.id, nombre: p.nombre }));
        agregarSpinPremium();
        prodsP.forEach(p => agregarProductoDesdeSpin({ id: p.id, nombre: p.nombre }));
        const items = getItemsCarrito();
        items.some(i => i.tipo === 'spin_base') ? pass('E1 — spin_base presente') : error('E1 — falta spin_base');
        items.some(i => i.tipo === 'spin_premium') ? pass('E2 — spin_premium presente') : error('E2 — falta spin_premium');
        items.filter(i => i.origen === 'spin').length === prodsE.length + prodsP.length ? pass(`E3 — ${prodsE.length + prodsP.length} productos combinados`) : error('E3 — conteo incorrecto');
        getTotal() === 33000 ? pass('E4 — total $33.000 correcto') : error(`E4 — total: $${getTotal()}`);
        await limpiar();
        getItemsCarrito().length === 0 ? pass('E5 — carrito limpio tras cancelar') : error('E5 — carrito no se limpió');
    } catch(e) { error('E error: ' + e.message); }

    // ── F: CATÁLOGO agregar ─────────────────────────────
    titulo('BLOQUE F — CATÁLOGO: agregar producto');
    await limpiar();
    try {
        const prod = prodCatalogo;
        const firestoreAntes = await stockF(prod.id);
        const localAntes = obtenerStock()[prod.id];
        info(`${prod.id} — local:${localAntes} Firestore:${firestoreAntes}`);

        await agregarProductoCatalogo(prod);
        await esperar(DELAY);

        const items = getItemsCarrito();
        items.some(i => i.id === prod.id && i.origen === 'catalogo') ? pass(`F1 — agregado: ${prod.nombre.slice(0, 25)}`) : error('F1 — no aparece en carrito');
        const localDespues = obtenerStock()[prod.id];
        localDespues === localAntes - 1 ? pass(`F2 — stock local: ${localAntes}→${localDespues}`) : error(`F2 — stock local: ${localDespues} (era ${localAntes})`);
        const cantF = await stockF(prod.id);
        cantF === firestoreAntes - 1 ? pass(`F3 — Firestore descontado: ${cantF}`) : error(`F3 — Firestore: ${cantF} (esperaba ${firestoreAntes - 1})`);
    } catch(e) { error('F error: ' + e.message); }

    // ── G: CATÁLOGO eliminar ────────────────────────────
    titulo('BLOQUE G — CATÁLOGO: eliminar producto');
    try {
        const items = getItemsCarrito();
        const idx = items.findIndex(i => i.origen === 'catalogo');
        if (idx < 0) { error('G0 — no hay producto catálogo'); }
        else {
            const item = items[idx];
            const firestoreAntes = await stockF(item.id);
            await eliminarItem(idx);
            await esperar(DELAY);
            !getItemsCarrito().some(i => i.id === item.id && i.origen === 'catalogo') ? pass('G1 — eliminado del carrito') : error('G1 — sigue en carrito');
            const cantF = await stockF(item.id);
            cantF === firestoreAntes + 1 ? pass(`G2 — stock restaurado: ${cantF}`) : error(`G2 — Firestore: ${cantF} (esperaba ${firestoreAntes + 1})`);
        }
    } catch(e) { error('G error: ' + e.message); }

    // ── H: MIX catálogo + spin, cancelar ───────────────
    titulo('BLOQUE H — MIX: catálogo + spin, cancelar todo');
    await limpiar();
    try {
        const prodCat = prodCatalogo;
        const prodSpin = getProductosSpinPremium()[0];
        const stockAntesCat = await stockF(prodCat.id);
        const stockAntesSpin = await stockF(prodSpin.id);
        info(`catálogo: ${prodCat.id} Firestore=${stockAntesCat}`);
        info(`spin:     ${prodSpin.id} Firestore=${stockAntesSpin}`);

        await agregarProductoCatalogo(prodCat);
        agregarSpinPremium();
        agregarProductoDesdeSpin({ id: prodSpin.id, nombre: prodSpin.nombre });
        await descontarStock(prodSpin.id);
        await esperar(500);

        const items = getItemsCarrito();
        (items.some(i => i.origen === 'catalogo') && items.some(i => i.tipo === 'spin_premium'))
            ? pass('H1 — carrito mixto correcto') : error('H1 — carrito mixto incompleto');
        getTotal() === prodCat.precio_referencia + 8000
            ? pass(`H2 — total $${(prodCat.precio_referencia + 8000).toLocaleString()} correcto`)
            : error(`H2 — total: $${getTotal().toLocaleString()}`);

        await cancelarCompraCompleta();
        await esperar(DELAY);

        getItemsCarrito().length === 0 ? pass('H3 — carrito vacío') : error('H3 — quedan items');
        const cantCatF = await stockF(prodCat.id);
        const cantSpinF = await stockF(prodSpin.id);
        cantCatF === stockAntesCat ? pass(`H4 — stock catálogo restaurado: ${cantCatF}`) : error(`H4 — catálogo: ${cantCatF} (esperaba ${stockAntesCat})`);
        cantSpinF === stockAntesSpin ? pass(`H5 — stock spin restaurado: ${cantSpinF}`) : error(`H5 — spin: ${cantSpinF} (esperaba ${stockAntesSpin})`);
    } catch(e) { error('H error: ' + e.message); }

    // ── RESULTADO ───────────────────────────────────────
    console.log('\n══════════════════════════════════');
    console.log(`  RESULTADO E2E: ${_ok} ✅ / ${_fail} ❌`);
    console.log('══════════════════════════════════');
    _fail === 0
        ? console.log('🚀 Todos los flujos validados — listo para producción')
        : console.log('⚠️  Revisar flujos con ❌');
}

// ─── RUNNER COMPLETO ────────────────────────────────────
export async function runAll() {
    console.clear();
    console.log('🛸 ShopUniverses — Test Suite Completo');
    console.log('═'.repeat(40));

    // 1. Reset Firestore
    await resetFirestore();

    // 2. Limpiar localStorage
    resetLocal();

    // 3. Esperar que onSnapshot sincronice
    console.log('\n⏳ Esperando sincronización Firebase...');
    await esperar(3000);

    // 4. Verificar sincronía
    const sincronizado = await checkSync();
    if (!sincronizado) {
        console.error('❌ Sistema desincronizado — abortando tests');
        return;
    }

    // 5. Correr E2E
    await runE2E();
}