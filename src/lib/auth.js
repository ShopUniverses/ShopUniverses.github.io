// ========================================================
// AUTH.JS — Autenticación de Administrador, Cookies y CSRF
// ========================================================
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { getDb, isFirebaseConfigured } from './firebase.js';
import { InventoryError } from './inventory.js';
import { nowIso } from './util.js';

export const COOKIE_NAME = 'su_admin';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const ADMINS_COL = 'admins';
const DUMMY_HASH = bcrypt.hashSync('shopuniverses-dummy-padding-key', 10);

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

function safeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Parsea las cookies de la cabecera HTTP Cookie. */
export function parseCookies(cookieHeader = '') {
  const out = {};
  for (const part of String(cookieHeader || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

/** Verifica credenciales contra Firestore (`admins/{email}`) o `.env` como respaldo inicial. */
export async function verifyAdminCredentials(email, password) {
  const normEmail = String(email || '').trim().toLowerCase();
  const pw = String(password || '').trim();
  if (!normEmail || !pw) return null;

  if (isFirebaseConfigured()) {
    try {
      const snap = await getDb().collection(ADMINS_COL).doc(normEmail).get();
      if (snap.exists && snap.data()?.passwordHash) {
        if (bcrypt.compareSync(pw, String(snap.data().passwordHash))) {
          return { email: normEmail };
        }
      }
    } catch (err) {
      console.warn('[auth] No se pudo consultar admins en Firestore:', err.message);
    }
  }

  // Tiempo constante incluso si se usa el respaldo de .env
  bcrypt.compareSync(pw, DUMMY_HASH);
  const envEmail = String(config.adminEmail || '').trim().toLowerCase();
  const envPass = String(config.adminPassword || '').trim();
  if (!envPass) return null;

  const validEmails = new Set([envEmail, 'admin@shopuniverses.com'].filter(Boolean));
  const emailMatch = [...validEmails].some((allowed) => safeEqualStr(normEmail, allowed));
  const passMatch = crypto.timingSafeEqual(sha256(pw), sha256(envPass));
  return emailMatch && passMatch ? { email: normEmail } : null;
}

/** Cambia la contraseña del administrador guardando el hash bcrypt en Firestore. */
export async function changeAdminPassword(email, currentPassword, newPassword) {
  const normEmail = String(email || '').trim().toLowerCase();
  const ok = await verifyAdminCredentials(normEmail, currentPassword);
  if (!ok) {
    throw new InventoryError('La contraseña actual es incorrecta.', 401);
  }
  if (typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 200) {
    throw new InventoryError('La nueva contraseña debe tener al menos 10 caracteres.', 400);
  }

  await getDb().collection(ADMINS_COL).doc(normEmail).set({
    email: normEmail,
    passwordHash: bcrypt.hashSync(newPassword, 10),
    updatedAt: nowIso(),
  });
  return true;
}

/** Genera un token de sesión firmado con HMAC-SHA256. */
export function createSessionToken(email) {
  const payload = {
    email: String(email || '').trim().toLowerCase(),
    csrf: crypto.randomBytes(16).toString('base64url'),
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

/** Valida un token de sesión y devuelve su payload o null. */
export function verifySessionToken(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payloadB64, sig] = parts;
  const expected = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(payloadB64)
    .digest('base64url');
  if (!safeEqualStr(sig, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (
      !payload ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      typeof payload.csrf !== 'string' ||
      !payload.csrf ||
      typeof payload.exp !== 'number' ||
      Date.now() > payload.exp
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function cookieAttrs(maxAgeSec) {
  return `Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${config.isProd ? '; Secure' : ''}`;
}

/** Inicia la sesión administrativa escribiendo la cookie firmada HttpOnly. */
export function startAdminSession(res, email) {
  const token = createSessionToken(email);
  res.append('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttrs(SESSION_TTL_MS / 1000)}`);
  return token;
}

/** Cierra la sesión administrativa limpiando la cookie. */
export function clearAdminSession(res) {
  res.append('Set-Cookie', `${COOKIE_NAME}=; ${cookieAttrs(0)}`);
}

/** Carga req.admin, req.csrf y res.locals si existe una sesión válida. */
export function loadAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySessionToken(cookies[COOKIE_NAME]);
  if (session) {
    req.admin = { email: session.email };
    req.csrf = session.csrf;
    res.locals.admin = req.admin;
    res.locals.csrf = session.csrf;
    res.set('Cache-Control', 'no-store');
  } else {
    req.admin = null;
    req.csrf = '';
    res.locals.admin = null;
    res.locals.csrf = '';
  }
  next();
}

/** Exige sesión administrativa activa; si no la hay, redirige a /admin/login. */
export function requireAdmin(req, res, next) {
  if (req.admin) return next();
  res.redirect('/admin/login');
}

/** Valida el token CSRF en formularios POST administrativos. */
export function checkCsrf(req, res, next) {
  const sent = String(req.body?._csrf || '');
  if (sent.length > 0 && req.csrf && safeEqualStr(sent, req.csrf)) {
    return next();
  }
  res.status(403).type('text/plain').send('Sesión vencida o formulario inválido. Recarga la página e inténtalo de nuevo.');
}
