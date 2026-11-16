#!/usr/bin/env node
// ========================================================
// DEV-SETUP.JS — Prepara el archivo .env local y muestra
// las credenciales de acceso al panel en consola (modelo Kobra).
// ========================================================
import fs from 'node:fs';
import crypto from 'node:crypto';

const file = '.env';
if (!fs.existsSync(file)) {
  fs.writeFileSync(
    file,
    'PORT=3000\nHOST=127.0.0.1\nSITE_URL=http://127.0.0.1:3000\n',
    'utf8',
  );
}

let text = fs.readFileSync(file, 'utf8');
const get = (key) => (new RegExp(`^${key}=(.*)$`, 'm').exec(text) || [])[1]?.trim() || '';
const set = (key, value) => {
  const re = new RegExp(`^${key}=.*$`, 'm');
  text = re.test(text)
    ? text.replace(re, `${key}=${value}`)
    : `${text.replace(/\s*$/, '\n')}${key}=${value}\n`;
};

if (!get('ADMIN_EMAIL')) set('ADMIN_EMAIL', 'jaidimportando@gmail.com');
if (!get('ADMIN_PASSWORD')) set('ADMIN_PASSWORD', crypto.randomBytes(9).toString('base64url'));
if (!get('STORE_EMAIL')) set('STORE_EMAIL', get('ADMIN_EMAIL'));
if (!get('SESSION_SECRET')) set('SESSION_SECRET', crypto.randomBytes(24).toString('base64url'));
if (!get('SPIN_SECRET')) set('SPIN_SECRET', crypto.randomBytes(24).toString('base64url'));

fs.writeFileSync(file, text, 'utf8');

const host = get('HOST') || '127.0.0.1';
const port = get('PORT') || '3000';
console.log('\n  Usuario del panel administrativo (.env):');
console.log(`    Correo:     ${get('ADMIN_EMAIL')}`);
console.log(`    Contraseña: ${get('ADMIN_PASSWORD')}`);
console.log(`    Panel:      http://${host}:${port}/admin\n`);
