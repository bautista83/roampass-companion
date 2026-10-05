import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../http';

export type PublicUser = Pick<User, 'id' | 'username' | 'role' | 'isActive' | 'createdAt'>;

export const publicUserSelect = { id: true, username: true, role: true, isActive: true, createdAt: true } as const;

declare module 'express-serve-static-core' {
  interface Request {
    user?: PublicUser;
  }
}

export const signToken = (userId: string) => jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });

/** Verifica el JWT y recarga el usuario: desactivar una cuenta corta su acceso al instante. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'No autenticado');
  let userId: string;
  try {
    userId = String(jwt.verify(header.slice(7), env.jwtSecret).sub);
  } catch {
    throw new HttpError(401, 'Sesion invalida o expirada');
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user || !user.isActive) throw new HttpError(401, 'Cuenta inexistente o desactivada');
  req.user = user;
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'ADMIN') throw new HttpError(403, 'Solo administradores');
  next();
};
