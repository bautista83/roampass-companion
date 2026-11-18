import { createHash, randomBytes } from 'node:crypto';
import type { EmailTokenPurpose } from '@prisma/client';
import { prisma } from '../db';
import { HttpError } from '../http';

const HOUR = 60 * 60 * 1000;

/** Vigencia de cada enlace (CO-02). */
export const TOKEN_TTL: Record<EmailTokenPurpose, number> = {
  VERIFY_EMAIL: 24 * HOUR,
  CHANGE_EMAIL: 24 * HOUR,
  RESET_PASSWORD: 1 * HOUR,
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Crea un enlace de un solo uso y devuelve el token en claro (solo viaja en el correo).
 * Invalida los enlaces anteriores del mismo tipo: vale solo el ultimo que se pidio.
 */
export async function createEmailToken(userId: string, purpose: EmailTokenPurpose, email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.emailToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.emailToken.create({
      data: { userId, purpose, email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]) },
    }),
  ]);
  return token;
}

/** Valida y marca como usado un enlace. Error INVALID_TOKEN si no existe, ya se uso o vencio. */
export async function consumeEmailToken(token: string, purposes: EmailTokenPurpose[]) {
  const found = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!found || !purposes.includes(found.purpose) || found.usedAt || found.expiresAt < new Date()) {
    throw new HttpError(400, 'El enlace no es válido o ya venció. Pide uno nuevo.', 'INVALID_TOKEN');
  }
  // updateMany con usedAt: null evita que dos clics simultaneos usen el mismo enlace.
  const { count } = await prisma.emailToken.updateMany({ where: { id: found.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count === 0) throw new HttpError(400, 'El enlace no es válido o ya venció. Pide uno nuevo.', 'INVALID_TOKEN');
  return found;
}

/** Dias que una cuenta puede quedar sin confirmar antes de liberarse (CO-03). */
export const UNVERIFIED_TTL_DAYS = 7;

/** Elimina registros sin confirmar viejos: su usuario y su correo quedan libres. */
export async function purgeUnverifiedAccounts(): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: {
      role: 'PLAYER',
      email: { not: null },
      emailVerifiedAt: null,
      createdAt: { lt: new Date(Date.now() - UNVERIFIED_TTL_DAYS * 24 * HOUR) },
    },
  });
  return count;
}
