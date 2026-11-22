// Celulares registrados para notificaciones push (docs/specs/mobile-app.md, 7.1).
import { Router } from 'express';
import { z } from 'zod';
import { DEVICE_PLATFORMS, MAX_DEVICES_PER_USER } from '@roampass/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

const tokenSchema = z.string().trim().min(10).max(4096);

/**
 * Registra (o actualiza) el token del celular actual. Si el token estaba en otra cuenta (otra
 * persona inicio sesion en ese celular), pasa a esta (MA-02). Maximo de dispositivos por usuario (D9).
 */
devicesRouter.post('/', async (req, res) => {
  const { token, platform, appVersion } = z
    .object({ token: tokenSchema, platform: z.enum(DEVICE_PLATFORMS), appVersion: z.string().trim().min(1).max(32) })
    .parse(req.body);
  const userId = req.user!.id;
  await prisma.deviceToken.upsert({
    where: { token },
    create: { token, platform, appVersion, userId },
    update: { platform, appVersion, userId, lastSeenAt: new Date() },
  });
  const extra = await prisma.deviceToken.findMany({
    where: { userId },
    orderBy: { lastSeenAt: 'desc' },
    skip: MAX_DEVICES_PER_USER,
    select: { id: true },
  });
  if (extra.length) await prisma.deviceToken.deleteMany({ where: { id: { in: extra.map((d) => d.id) } } });
  res.status(204).end();
});

/** Al cerrar sesion en el celular (MA-03). El token va en el cuerpo, no en la URL. */
devicesRouter.delete('/', async (req, res) => {
  const { token } = z.object({ token: tokenSchema }).parse(req.body);
  await prisma.deviceToken.deleteMany({ where: { token, userId: req.user!.id } });
  res.status(204).end();
});
