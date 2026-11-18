import './loadEnv';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver .env.example en la raiz)`);
  return value;
}

const optional = (name: string) => process.env[name]?.trim() || undefined;

/** Origenes permitidos (separados por coma). El primero es la URL publica por defecto. */
const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean);
const corsOrigin = corsOrigins[0]!;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET'),
  corsOrigin,
  corsOrigins,
  /** URL publica de la app: los enlaces de los correos apuntan aca. */
  appUrl: (optional('APP_URL') ?? corsOrigin).replace(/\/$/, ''),
  /** Sin SMTP_HOST los correos no se envian: el enlace se imprime en la consola (desarrollo). */
  smtp: optional('SMTP_HOST')
    ? {
        host: optional('SMTP_HOST')!,
        port: Number(process.env.SMTP_PORT ?? 587),
        user: optional('SMTP_USER'),
        pass: optional('SMTP_PASS'),
      }
    : null,
  mailFrom: optional('MAIL_FROM') ?? 'Roamle <no-reply@localhost>',
  /** Captcha de Cloudflare en el registro. Sin clave, apagado. */
  turnstileSecret: optional('TURNSTILE_SECRET_KEY'),
  /** Detras de Cloudflare Tunnel: la IP real del cliente viene en CF-Connecting-IP. */
  trustCloudflare: process.env.TRUST_CLOUDFLARE === 'true',
  /**
   * Clave de Google para la foto fija de Street View que ven los espectadores en partidas online.
   * Si la clave del cliente esta restringida por dominio, usar otra en GOOGLE_MAPS_API_KEY.
   */
  googleMapsKey: optional('GOOGLE_MAPS_API_KEY') ?? optional('VITE_GOOGLE_MAPS_API_KEY'),
};
