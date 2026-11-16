#!/usr/bin/env node
// ========================================================
// BUILD-STATIC.JS — Genera la carpeta dist/ que publica Netlify
// --------------------------------------------------------
// Copia SOLO lo público (páginas HTML y assets) y genera una versión
// del inventario sin costos. Nada de src/, node_modules/ ni .env.
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { legacyPublicCatalog } from '../src/lib/catalog.js';

const root = config.root;
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });

let pages = 0;
for (const file of fs.readdirSync(root)) {
  if (file.endsWith('.html')) {
    fs.copyFileSync(path.join(root, file), path.join(dist, file));
    pages++;
  }
}

fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, 'data', 'inventario.json'), JSON.stringify(legacyPublicCatalog(), null, 2));

console.log(`✔ dist/ generado: ${pages} páginas, assets e inventario público (sin costos).`);
