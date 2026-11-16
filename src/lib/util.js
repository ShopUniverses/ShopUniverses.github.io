// ========================================================
// UTIL.JS — Formateadores y Utilidades Comunes
// ========================================================

/** Formatea un número como pesos colombianos (ej. $ 25.000) */
export function fmtCOP(valor) {
  const n = Number(valor) || 0;
  return '$ ' + n.toLocaleString('es-CO');
}

/** Formatea una fecha ISO a formato legible colombiano */
export function fmtDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Genera un slug apto para URL */
export function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Retorna la fecha y hora actual en formato ISO */
export function nowIso() {
  return new Date().toISOString();
}

/** Genera un código de orden corto y legible (ej. SU-72941) */
export function generateOrderCode() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `SU-${num}`;
}
