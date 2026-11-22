// Envio de notificaciones push (docs/specs/mobile-app.md, 5.2 y MA-01..MA-07).

import type { PushType } from '@roampass/shared';
import { prisma } from '../db';
import { isUserLooking } from '../online/notify';
import { pushText, type PushParams } from './messages';
import { pushTransport } from './transport';

interface PushOptions {
  params?: PushParams;
  /** Ruta que abre la app al tocarla. */
  link: string;
  /** Etiqueta para reemplazar avisos viejos del mismo tema. */
  tag: string;
  ttlSeconds: number;
}

/**
 * Manda un push a todos los celulares del usuario. Nunca lanza errores (MA-06): quien lo llama no
 * espera el resultado. No se manda si el push esta apagado, si el usuario lo silencio, si esta
 * inactivo (MA-07) o si tiene la app a la vista (D7).
 */
export async function sendPush(userId: string, type: PushType, options: PushOptions): Promise<void> {
  if (!pushTransport) return;
  try {
    if (isUserLooking(userId)) return;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, locale: true, pushMuted: true, devices: { select: { token: true } } },
    });
    if (!user?.isActive || user.pushMuted.includes(type) || !user.devices.length) return;
    const { title, body } = pushText(type, options.params ?? {}, user.locale);
    const tokens = user.devices.map((d) => d.token);
    const { invalidTokens } = await pushTransport.send(tokens, { title, body, link: options.link, type, tag: options.tag, ttlSeconds: options.ttlSeconds });
    if (invalidTokens.length) await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
  } catch (err) {
    console.error(`🔔 No se pudo enviar el push ${type}:`, err);
  }
}

/** Atajo para no esperar el envio (las acciones del juego no se demoran por el push). */
export const pushLater = (userId: string, type: PushType, options: PushOptions) => void sendPush(userId, type, options);
