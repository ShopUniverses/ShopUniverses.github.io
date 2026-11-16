#!/usr/bin/env node
// ========================================================
// OPTIMIZE-IMAGES.JS — Verifica y optimiza fotos del catálogo
// --------------------------------------------------------
// Uso: npm run optimize-images
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { loadCatalog } from '../src/lib/catalog.js';
import { optimizeImageBuffer } from '../src/lib/images.js';

const { productos } = loadCatalog();
const uniquePaths = [...new Set(productos.map((p) => p.imagen).filter(Boolean))];

let verified = 0;
let optimized = 0;
let bytesSaved = 0;
const missing = [];

for (const relPath of uniquePaths) {
  const fullPath = path.join(config.root, relPath);
  if (!fs.existsSync(fullPath)) {
    missing.push(relPath);
    continue;
  }

  verified++;
  const original = fs.readFileSync(fullPath);
  const next = await optimizeImageBuffer(original, { width: 640, quality: 80 });

  if (next.length < original.length) {
    fs.writeFileSync(fullPath, next);
    const saved = original.length - next.length;
    bytesSaved += saved;
    optimized++;
    console.log(`✔ ${relPath}: ${original.length} B -> ${next.length} B (-${saved} B)`);
  } else {
    console.log(`• ${relPath}: ya optimizada (${original.length} B)`);
  }
}

console.log(`\nResumen Sharp: ${verified}/${uniquePaths.length} verificadas, ${optimized} optimizadas, ${(bytesSaved / 1024).toFixed(1)} KB ahorrados.`);

if (missing.length > 0) {
  console.error(`✖ Imágenes faltantes (${missing.length}):`, missing);
  process.exit(1);
}
