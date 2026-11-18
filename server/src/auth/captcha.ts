import { env } from '../env';
import { HttpError } from '../http';

/** Verificacion del captcha Turnstile de Cloudflare. Sin TURNSTILE_SECRET_KEY esta apagado (D9). */
export async function verifyCaptcha(token: string | undefined, ip: string | undefined): Promise<void> {
  if (!env.turnstileSecret) return;
  const fail = () => new HttpError(400, 'No pudimos verificar que no eres un robot. Vuelve a intentarlo.', 'CAPTCHA_FAILED');
  if (!token) throw fail();
  const body = new URLSearchParams({ secret: env.turnstileSecret, response: token, ...(ip && { remoteip: ip }) });
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) throw fail();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw fail();
  }
}
