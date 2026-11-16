// ========================================================
// HTTP.JS — Rate limiting y manejo uniforme de errores
// ========================================================
import rateLimit from 'express-rate-limit';

/** Límite general para la API pública. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});

/** Límite estricto para operaciones que mueven stock (anti-bots / card testing). */
export const stockLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera un momento antes de volver a intentarlo.' },
});

/** Envuelve handlers async para que los errores lleguen al middleware de errores. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Middleware de errores para rutas /api: nunca filtra detalles internos. */
export function apiErrorHandler(err, req, res, _next) {
  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({
    error: status >= 500 && status !== 503 ? 'Error interno. Intenta de nuevo más tarde.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
