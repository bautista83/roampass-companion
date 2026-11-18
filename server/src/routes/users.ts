import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { HttpError } from '../http';
import { credentialsSchema } from '../auth/routes';
import { publicUserSelect, requireAdmin, requireAuth } from '../auth/middleware';

const createSchema = credentialsSchema.extend({ role: z.enum(['ADMIN', 'PLAYER']).default('PLAYER') });
const updateSchema = z
  .object({
    username: credentialsSchema.shape.username,
    password: credentialsSchema.shape.password,
    role: z.enum(['ADMIN', 'PLAYER']),
    isActive: z.boolean(),
    /** Confirmar el correo a mano (si el mensaje no llego). */
    emailVerified: z.literal(true),
  })
  .partial();

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { ...publicUserSelect, _count: { select: { hostedGames: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users: users.map(({ _count, ...u }) => ({ ...u, gamesHosted: _count.hostedGames })) });
});

usersRouter.post('/', async (req, res) => {
  const { password, ...data } = createSchema.parse(req.body);
  const user = await prisma.user.create({
    data: { ...data, passwordHash: await bcrypt.hash(password, 10) },
    select: publicUserSelect,
  });
  res.status(201).json({ user });
});

usersRouter.patch('/:id', async (req, res) => {
  const { password, emailVerified, ...data } = updateSchema.parse(req.body);
  const isSelf = req.params.id === req.user!.id;
  // Evita que el ultimo admin se bloquee a si mismo fuera del panel.
  if (isSelf && (data.isActive === false || data.role === 'PLAYER')) {
    throw new HttpError(400, 'No puedes desactivarte ni quitarte el rol ADMIN a ti mismo');
  }
  const target = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id }, select: { email: true, emailVerifiedAt: true } });
  // "Activar" o "Confirmar correo" tambien dan por confirmado el correo (CO-08).
  const verify = (emailVerified || data.isActive === true) && target.email && !target.emailVerifiedAt;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...data,
      ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
      ...(verify && { emailVerifiedAt: new Date() }),
    },
    select: publicUserSelect,
  });
  res.json({ user });
});

usersRouter.delete('/:id', async (req, res) => {
  if (req.params.id === req.user!.id) throw new HttpError(400, 'No puedes eliminar tu propia cuenta');
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
