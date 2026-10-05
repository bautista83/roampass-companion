import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { HttpError } from '../http';
import { publicUserSelect, requireAuth, signToken } from './middleware';

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, numeros, punto, guion y guion bajo'),
  password: z.string().min(6).max(128),
});

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { username, password } = credentialsSchema.parse(req.body);
  const user = await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'PLAYER' },
    select: publicUserSelect,
  });
  res.status(201).json({ token: signToken(user.id), user });
});

authRouter.post('/login', async (req, res) => {
  const { username, password } = credentialsSchema.parse(req.body);
  const found = await prisma.user.findUnique({ where: { username } });
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  if (!found.isActive) throw new HttpError(403, 'Cuenta desactivada. Contacta a un administrador.');
  const { passwordHash: _, updatedAt: __, ...user } = found;
  res.json({ token: signToken(user.id), user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
