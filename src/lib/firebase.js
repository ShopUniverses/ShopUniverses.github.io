// ========================================================
// FIREBASE.JS — Firebase Admin SDK (solo servidor)
// --------------------------------------------------------
// Las credenciales NUNCA llegan al navegador. Se leen de:
//   1. FIREBASE_SERVICE_ACCOUNT_PATH (archivo JSON local, desarrollo), o
//   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (Netlify).
// ========================================================
import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config.js';

let _db = null;
let _override = null;

function loadCredentials() {
  const { serviceAccountPath, projectId, clientEmail, privateKey } = config.firebase;

  if (serviceAccountPath) {
    const file = path.resolve(config.root, serviceAccountPath);
    if (!fs.existsSync(file)) throw new Error(`No existe el archivo de cuenta de servicio: ${file}`);
    return cert(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }
  return null;
}

/** Indica si hay credenciales disponibles para conectarse a Firestore. */
export function isFirebaseConfigured() {
  if (_override) return true;
  const { serviceAccountPath, projectId, clientEmail, privateKey } = config.firebase;
  return Boolean(serviceAccountPath || (projectId && clientEmail && privateKey));
}

/** Devuelve la instancia de Firestore (inicialización perezosa). */
export function getDb() {
  if (_override) return _override;
  if (_db) return _db;

  const credential = loadCredentials();
  if (!credential) {
    const err = new Error('Firebase no está configurado. Revisa las variables FIREBASE_* en .env');
    err.status = 503;
    throw err;
  }

  const app = getApps()[0] || initializeApp({ credential, projectId: config.firebase.projectId });
  _db = getFirestore(app);
  return _db;
}

/** Solo para pruebas: inyecta una base de datos simulada. */
export function __setDbForTests(fakeDb) {
  _override = fakeDb;
}
