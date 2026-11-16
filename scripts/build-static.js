#!/usr/bin/env node
// ========================================================
// BUILD-STATIC.JS — Genera la carpeta dist/ que publica Netlify
// --------------------------------------------------------
// Copia SOLO los assets públicos (dist/assets) y genera una versión
// del inventario sin costos. Las páginas HTML se renderizan vía SSR (EJS).
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { legacyPublicCatalog } from '../src/lib/catalog.js';

const root = config.root;
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });

fs.cpSync(path.join(root, 'assets'), path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, 'data', 'inventario.json'), JSON.stringify(legacyPublicCatalog(), null, 2));

console.log('✔ dist/ generado: assets e inventario público (sin costos). Las vistas se sirven por SSR.');
