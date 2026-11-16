#!/usr/bin/env node
// ========================================================
// CREATE-ADMIN.JS — Crea o restablece la contraseña de un admin
// --------------------------------------------------------
// Uso:
//   npm run create-admin -- correo@ejemplo.com "contraseña-larga"
// ========================================================
import { createAdmin, validatePassword } from '../src/lib/auth.js';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: npm run create-admin -- correo@ejemplo.com "contraseña de al menos 10 caracteres"');
  process.exit(1);
}

const bad = validatePassword(password);
if (bad) {
  console.error(bad);
  process.exit(1);
}

const admin = await createAdmin(email, password, 'Administración');
console.log(`Administrador guardado en Firestore: ${admin.email}`);
