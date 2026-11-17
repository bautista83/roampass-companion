import { rateLimit } from 'express-rate-limit';

// Limites por IP para frenar ataques de fuerza bruta cuando la app esta publicada en Internet.
// Responden con el mismo formato que el resto de errores de la API: { error }.
const message = (text: string) => ({ error: text });

/** Login: 10 intentos FALLIDOS cada 15 minutos (los exitosos no cuentan). */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiados intentos de inicio de sesión. Probá de nuevo en unos minutos.'),
});

/** Registro: 5 cuentas nuevas por hora desde la misma IP. */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: message('Demasiados registros desde esta conexión. Probá de nuevo más tarde.'),
});
