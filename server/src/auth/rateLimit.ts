import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { env } from '../env';

// Limites por IP para frenar ataques de fuerza bruta cuando la app esta publicada en Internet.
// Responden con el mismo formato que el resto de errores de la API: { error, code }.
const message = (text: string) => ({ error: text, code: 'RATE_LIMITED' });

/**
 * IP real del cliente. Detras de Cloudflare Tunnel todas las conexiones llegan desde cloudflared:
 * sin esto, 10 logins fallidos de cualquiera bloquearian a todos. La API solo escucha en 127.0.0.1
 * (se entra por el Nginx de la VM), asi que el encabezado es confiable cuando TRUST_CLOUDFLARE=true.
 */
export function clientIp(req: Request): string {
  const cf = env.trustCloudflare ? req.get('cf-connecting-ip')?.trim() : undefined;
  return cf || req.ip || 'unknown';
}

const common: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
};

/** Login: 10 intentos FALLIDOS cada 15 minutos (los exitosos no cuentan). */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: message('Demasiados intentos de inicio de sesión. Prueba de nuevo en unos minutos.'),
});

/** Registro: 5 cuentas nuevas por hora desde la misma IP. */
export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: message('Demasiados registros desde esta conexión. Prueba de nuevo más tarde.'),
});

/** Reenviar confirmacion y pedir recuperacion: 3 correos por hora por IP (CO-04). */
export const emailLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: message('Ya enviamos varios correos. Revisa tu bandeja (y el spam) o prueba más tarde.'),
});

/** Invitaciones por correo: 20 por hora por IP (ademas de los limites por usuario, D8). */
export const inviteLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: message('Demasiadas invitaciones desde esta conexión. Prueba de nuevo más tarde.'),
});

/** Abrir enlaces (confirmar, restablecer): frena probar tokens al azar. */
export const tokenLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: message('Demasiados intentos. Prueba de nuevo en unos minutos.'),
});
