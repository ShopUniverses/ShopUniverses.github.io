// ========================================================
// IMPORT-PRODUCTS.JS — Parser CSV/JSON y Carga Masiva
// ========================================================
import {
  getCatalog,
  ensureCatalogSeeded,
  upsertProduct,
} from './catalog.js';
import { getStockMap, setProductStock } from './inventory.js';

function slugifyId(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeHeader(h) {
  return String(h || '')
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseBool(val) {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (['true', '1', 'si', 'yes', 'y', 's', 'x'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function parseMoney(val) {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return Number.isFinite(val) ? Math.round(val) : NaN;
  let s = String(val).trim().replace(/\$/g, '').replace(/\s+/g, '');
  if (!s) return undefined;
  // Formato colombiano con separadores de miles por punto (ej: 12.000 o 1.250.000)
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function parseOptionalInt(val) {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(String(val).trim());
  if (!Number.isFinite(n)) return NaN;
  return Math.floor(n);
}

/** Detecta el delimitador de la primera línea CSV fuera de comillas (';' vs ','). */
function detectDelimiter(text) {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '\n' || ch === '\r') break;
      if (ch === ',') commas++;
      if (ch === ';') semis++;
    }
  }
  return semis > commas ? ';' : ',';
}

/** Parser CSV compatible con RFC-4180 (BOM UTF-8, comillas dobles, ';' o ','). */
export function parseCsv(rawText) {
  const text = String(rawText || '').replace(/^\uFEFF/, '');
  if (!text.trim()) return [];

  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map((cells, idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => {
      if (h) obj[h] = cells[i] ?? '';
    });
    return obj;
  });
}

function mapRawRecord(raw, idx) {
  const rowNum = raw?._row || idx + 1;
  const pick = (...keys) => {
    for (const k of keys) {
      if (raw && raw[k] !== undefined && raw[k] !== '') return raw[k];
    }
    return undefined;
  };

  const id = pick('id', 'slug', 'codigo', 'sku');
  const nombre = pick('nombre', 'name', 'producto', 'titulo', 'title');
  const categoria = pick('categoria', 'category', 'linea');
  const precioRaw = pick('precio_referencia', 'precio', 'price', 'pvp');
  const costoRaw = pick('costo', 'cost', 'costo_unitario');
  const stockRaw = pick('stock', 'cantidad', 'existencias', 'qty');
  const imagen = pick('imagen', 'image', 'foto', 'url_imagen');
  const pesoRaw = pick('peso_spin', 'peso', 'weight');

  const flagsIn = raw && typeof raw.flags === 'object' && raw.flags ? raw.flags : {};
  const catalogo = parseBool(pick('catalogo', 'en_catalogo', 'in_catalog') ?? flagsIn.catalogo);
  const spinEstandar = parseBool(
    pick('spin_estandar', 'ruleta_estandar', 'spin') ?? flagsIn.spin_estandar,
  );
  const spinPremium = parseBool(
    pick('spin_premium', 'ruleta_premium', 'premium') ?? flagsIn.spin_premium,
  );
  const activo = parseBool(pick('activo', 'active', 'visible'));

  return {
    _row: rowNum,
    id: id !== undefined ? String(id).trim() : '',
    nombre: nombre !== undefined ? String(nombre).trim() : '',
    categoria: categoria !== undefined ? String(categoria).trim() : undefined,
    precio: parseMoney(precioRaw),
    costo: parseMoney(costoRaw),
    stock: parseOptionalInt(stockRaw),
    imagen: imagen !== undefined ? String(imagen).trim() : undefined,
    peso_spin: parseOptionalInt(pesoRaw),
    flags: {
      catalogo,
      spin_estandar: spinEstandar,
      spin_premium: spinPremium,
    },
    activo,
  };
}

/**
 * Parsea un archivo subido (.json o .csv) y devuelve registros normalizados.
 */
export function parseBulkCatalogFile({ buffer, filename = '', mimetype = '' }) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('Debes seleccionar un archivo CSV o JSON no vacío.');
    err.status = 400;
    throw err;
  }

  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const trimmed = text.trim();
  const lowerName = String(filename || '').toLowerCase();
  const isJson =
    lowerName.endsWith('.json') ||
    mimetype.includes('json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[');

  let rawRows;
  if (isJson) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const err = new Error('El archivo JSON no tiene una sintaxis válida.');
      err.status = 400;
      throw err;
    }
    rawRows = Array.isArray(parsed) ? parsed : parsed?.productos;
    if (!Array.isArray(rawRows)) {
      const err = new Error('El JSON debe ser un arreglo de productos o un objeto con la propiedad "productos".');
      err.status = 400;
      throw err;
    }
  } else {
    rawRows = parseCsv(text);
  }

  if (rawRows.length === 0) {
    const err = new Error('El archivo no contiene filas de productos para importar.');
    err.status = 400;
    throw err;
  }

  if (rawRows.length > 500) {
    const err = new Error('El límite por archivo es de 500 productos por importación.');
    err.status = 400;
    throw err;
  }

  return rawRows.map((row, idx) => mapRawRecord(row, idx));
}

/**
 * Aplica una lista de registros normalizados sobre Firestore (`products` e `Inventario`).
 */
export async function importCatalogItems(
  items,
  { overwrite = true, updateStock = true, actor = '', note = 'Importación masiva' } = {},
) {
  await ensureCatalogSeeded();
  const { byId } = await getCatalog({ includeInactive: true });

  const summary = {
    total: items.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const item of items) {
    try {
      let existing = item.id ? byId.get(item.id) || null : null;
      const slugCandidate = slugifyId(item.id || item.nombre);
      if (!existing && slugCandidate) {
        existing = byId.get(slugCandidate) || null;
      }

      if (existing && !overwrite) {
        summary.skipped++;
        continue;
      }

      if (item.precio !== undefined && Number.isNaN(item.precio)) {
        throw new Error('Precio inválido.');
      }
      if (item.costo !== undefined && Number.isNaN(item.costo)) {
        throw new Error('Costo inválido.');
      }
      if (item.stock !== undefined && (Number.isNaN(item.stock) || item.stock < 0)) {
        throw new Error('Stock inválido.');
      }
      if (item.peso_spin !== undefined && Number.isNaN(item.peso_spin)) {
        throw new Error('peso_spin inválido.');
      }

      const isNew = !existing;
      const targetId = existing ? existing.id : slugCandidate;
      if (!targetId) {
        throw new Error('Falta "id" o "nombre" válido.');
      }

      const nombre = item.nombre || existing?.nombre || '';
      if (nombre.length < 2) {
        throw new Error('El nombre debe tener al menos 2 caracteres.');
      }

      const precioRef =
        item.precio !== undefined ? item.precio : existing?.precio_referencia;
      if (!Number.isFinite(precioRef) || precioRef < 0) {
        throw new Error('Falta un precio válido mayor o igual a 0.');
      }

      const payload = {
        id: targetId,
        nombre,
        categoria: item.categoria ?? existing?.categoria ?? 'Otros',
        precio_referencia: precioRef,
        costo: item.costo !== undefined ? item.costo : existing?.costo ?? 0,
        imagen: item.imagen ?? existing?.imagen,
        peso_spin:
          item.peso_spin !== undefined ? item.peso_spin : existing?.peso_spin ?? 10,
        flags: {
          catalogo:
            item.flags.catalogo !== undefined
              ? item.flags.catalogo
              : existing?.flags?.catalogo ?? true,
          spin_estandar:
            item.flags.spin_estandar !== undefined
              ? item.flags.spin_estandar
              : existing?.flags?.spin_estandar ?? false,
          spin_premium:
            item.flags.spin_premium !== undefined
              ? item.flags.spin_premium
              : existing?.flags?.spin_premium ?? false,
        },
        activo:
          item.activo !== undefined
            ? item.activo
            : existing
              ? existing.activo !== false
              : true,
      };

      const saved = await upsertProduct(payload, { isNew });
      byId.set(saved.id, saved);

      if (updateStock && item.stock !== undefined) {
        await setProductStock(saved.id, item.stock, {
          reason: isNew ? 'creacion_masiva' : 'carga_masiva',
          note,
          actor,
        });
      } else if (isNew) {
        await setProductStock(saved.id, 0, {
          reason: 'creacion_masiva',
          note,
          actor,
        });
      }

      if (isNew) summary.created++;
      else summary.updated++;
    } catch (err) {
      summary.errors.push({
        row: item._row,
        id: item.id || item.nombre || '(sin id)',
        message: err?.message || 'Error procesando fila.',
      });
    }
  }

  return summary;
}

function csvCell(val) {
  const s = val === undefined || val === null ? '' : String(val);
  if (s.includes(';') || s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Genera un archivo CSV con UTF-8 BOM compatible con Excel en español. */
export async function exportCatalogCsv() {
  const [{ productos }, stockMap] = await Promise.all([
    getCatalog({ includeInactive: true }),
    getStockMap(),
  ]);

  const headers = [
    'id',
    'nombre',
    'categoria',
    'precio_referencia',
    'costo',
    'stock',
    'catalogo',
    'spin_estandar',
    'spin_premium',
    'peso_spin',
    'activo',
    'imagen',
  ];

  const rows = productos.map((p) => [
    p.id,
    p.nombre,
    p.categoria,
    p.precio_referencia,
    p.costo || 0,
    Number.isFinite(stockMap[p.id]) ? stockMap[p.id] : 0,
    p.flags?.catalogo ? 'si' : 'no',
    p.flags?.spin_estandar ? 'si' : 'no',
    p.flags?.spin_premium ? 'si' : 'no',
    p.peso_spin || 1,
    p.activo === false ? 'no' : 'si',
    p.imagen || '',
  ]);

  const lines = [headers.join(';'), ...rows.map((r) => r.map(csvCell).join(';'))];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
