import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { HttpError } from '../http';
import { publicUserSelect, requireAuth, signToken } from './middleware';
import { loginLimiter, registerLimiter } from './rateLimit';

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

/**
 * Registro publico: la cuenta nace INACTIVA y no recibe token. Un ADMIN la aprueba desde
 * Administracion de usuarios (Activar) y recien ahi el jugador puede iniciar sesion.
 */
authRouter.post('/register', registerLimiter, async (req, res) => {
  const { username, password } = credentialsSchema.parse(req.body);
  await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10), role: 'PLAYER', isActive: false },
  });
  res.status(201).json({
    pending: true,
    message: 'Pasaporte solicitado. Un administrador tiene que aprobarlo antes de que puedas iniciar sesión.',
  });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = credentialsSchema.parse(req.body);
  const found = await prisma.user.findUnique({ where: { username } });
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  if (!found.isActive) {
    throw new HttpError(403, 'Tu cuenta está pendiente de aprobación o fue desactivada. Contactá a un administrador.');
  }
  const { passwordHash: _, updatedAt: __, ...user } = found;
  res.json({ token: signToken(user.id), user });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** Mi perfil: cada usuario cambia su estilo visual y su contraseña (con la actual). */
const profileSchema = z
  .object({
    theme: z.enum(['COMIC', 'RETRO']).optional(),
    currentPassword: z.string().optional(),
    newPassword: credentialsSchema.shape.password.optional(),
  })
  .refine((d) => !d.newPassword || d.currentPassword, { message: 'Ingresá tu contraseña actual', path: ['currentPassword'] });

authRouter.patch('/me', requireAuth, async (req, res) => {
  const { theme, currentPassword, newPassword } = profileSchema.parse(req.body);
  let passwordHash: string | undefined;
  if (newPassword) {
    const found = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(currentPassword!, found.passwordHash))) {
      throw new HttpError(400, 'La contraseña actual no es correcta');
    }
    passwordHash = await bcrypt.hash(newPassword, 10);
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { ...(theme && { theme }), ...(passwordHash && { passwordHash }) },
    select: publicUserSelect,
  });
  res.json({ user });
});
