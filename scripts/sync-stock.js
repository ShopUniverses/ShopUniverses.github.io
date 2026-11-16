#!/usr/bin/env node
// ========================================================
// SYNC-STOCK.JS — Compara inventario.json con Firestore
// --------------------------------------------------------
// Uso:
//   npm run sync-stock              -> solo muestra diferencias (no escribe nada)
//   npm run sync-stock -- --apply   -> crea en Firestore los productos que falten
//
// Nunca sobrescribe un stock existente: las ventas reales viven en Firestore.
// ========================================================
import { getDb } from '../src/lib/firebase.js';
import { loadCatalog } from '../src/lib/catalog.js';

const apply = process.argv.includes('--apply');

const db = getDb();
const { productos } = loadCatalog();
const snap = await db.collection('stock').get();
const remoto = new Map(snap.docs.map((d) => [d.id, d.data().Cantidad]));

const faltantes = productos.filter((p) => !remoto.has(p.id));
const huerfanos = [...remoto.keys()].filter((id) => !productos.some((p) => p.id === id));
const excedidos = productos.filter((p) => remoto.has(p.id) && remoto.get(p.id) > p.stock);

console.log(`Productos en inventario.json: ${productos.length}`);
console.log(`Documentos en Firestore/stock: ${remoto.size}`);
console.log(`\nFaltan en Firestore (${faltantes.length}):`);
faltantes.forEach((p) => console.log(`  + ${p.id}  -> Cantidad inicial ${p.stock}`));
console.log(`\nEn Firestore pero no en el JSON (${huerfanos.length}):`);
huerfanos.forEach((id) => console.log(`  ? ${id}`));
console.log(`\nStock en Firestore mayor al máximo del JSON (${excedidos.length}):`);
excedidos.forEach((p) => console.log(`  ! ${p.id}  Firestore=${remoto.get(p.id)}  JSON=${p.stock}`));

if (!apply) {
  console.log('\nModo lectura. Usa --apply para crear los faltantes.');
  process.exit(0);
}

const batch = db.batch();
faltantes.forEach((p) => batch.set(db.collection('stock').doc(p.id), { Cantidad: p.stock }));
await batch.commit();
console.log(`\n✔ Creados ${faltantes.length} documentos en Firestore.`);
