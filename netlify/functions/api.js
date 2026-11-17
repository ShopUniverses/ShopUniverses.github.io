// ========================================================
// NETLIFY FUNCTION — Adaptador Serverless para Express
// ========================================================
import serverless from 'serverless-http';
import { app } from '../../src/server.js';

const rawHandler = serverless(app, {
  binary: ['image/*', 'font/*', 'application/octet-stream'],
});

const FN_PREFIX = '/.netlify/functions/api';

function normalizeNetlifyEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const currentPath = typeof event.path === 'string' ? event.path : '/';

  if (!currentPath.startsWith(FN_PREFIX)) return event;

  let resolvedPath = '';
  if (typeof event.rawUrl === 'string' && event.rawUrl) {
    try {
      const parsed = new URL(event.rawUrl);
      if (parsed.pathname && !parsed.pathname.startsWith(FN_PREFIX)) {
        resolvedPath = parsed.pathname;
      }
    } catch {
      // ignorar rawUrl malformada
    }
  }

  if (!resolvedPath) {
    resolvedPath = currentPath.slice(FN_PREFIX.length) || '/';
  }

  return { ...event, path: resolvedPath };
}

export const handler = (event, context) => rawHandler(normalizeNetlifyEvent(event), context);
