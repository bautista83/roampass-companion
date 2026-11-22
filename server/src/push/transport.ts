// Como salen los push: Firebase Cloud Messaging (con FIREBASE_SERVICE_ACCOUNT) o la consola.
// Igual que el correo sin SMTP: sin credenciales el push queda apagado y el resto funciona (CA-10).

import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../env';

export interface PushMessage {
  title: string;
  body: string;
  /** Ruta de la app que se abre al tocar la notificacion (D10). */
  link: string;
  type: string;
  /** Reemplaza a una notificacion anterior con la misma etiqueta (p. ej. el turno de una partida). */
  tag: string;
  /** Cuanto sirve el aviso: si el celular esta apagado mas tiempo, ya no se muestra. */
  ttlSeconds: number;
}

export interface PushTransport {
  /** Envia a varios tokens; devuelve los que ya no sirven (app desinstalada, MA-04). */
  send(tokens: string[], message: PushMessage): Promise<{ invalidTokens: string[] }>;
}

/** Codigos de Firebase que significan "este token no sirve mas". */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

function firebaseTransport(serviceAccountBase64: string): PushTransport {
  const credentials = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
  const app: App = initializeApp({ credential: cert(credentials) }, 'roamle-push');
  const messaging = getMessaging(app);
  return {
    async send(tokens, m) {
      const res = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: m.title, body: m.body },
        data: { link: m.link, type: m.type },
        android: { priority: 'high', ttl: m.ttlSeconds * 1000, collapseKey: m.tag, notification: { tag: m.tag, channelId: 'roamle' } },
        apns: {
          headers: { 'apns-expiration': String(Math.floor(Date.now() / 1000) + m.ttlSeconds), 'apns-collapse-id': m.tag.slice(0, 64) },
          payload: { aps: { sound: 'default' } },
        },
      });
      const invalidTokens = res.responses
        .map((r, i) => (!r.success && r.error && INVALID_TOKEN_CODES.has(r.error.code) ? tokens[i]! : null))
        .filter((t): t is string => t !== null);
      for (const r of res.responses) {
        if (!r.success && r.error && !INVALID_TOKEN_CODES.has(r.error.code)) console.error('🔔 Error de Firebase:', r.error.code);
      }
      return { invalidTokens };
    },
  };
}

/**
 * Transporte de desarrollo (PUSH_LOG=true sin Firebase): imprime cada push en la consola como una
 * linea `🔔 PUSH {json}`. Los tokens que empiezan con "invalid-" se tratan como desinstalados,
 * para poder probar la limpieza de tokens.
 */
const logTransport: PushTransport = {
  async send(tokens, message) {
    console.log(`🔔 PUSH ${JSON.stringify({ tokens, ...message })}`);
    return { invalidTokens: tokens.filter((t) => t.startsWith('invalid-')) };
  },
};

function createTransport(): PushTransport | null {
  if (env.firebaseServiceAccount) {
    try {
      return firebaseTransport(env.firebaseServiceAccount);
    } catch (err) {
      console.error('🔔 FIREBASE_SERVICE_ACCOUNT no es valida; las notificaciones quedan apagadas.', err);
      return null;
    }
  }
  return env.pushLog ? logTransport : null;
}

export const pushTransport = createTransport();
