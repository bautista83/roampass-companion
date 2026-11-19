import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { SUPPORTED_LOCALES } from '@roampass/shared';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../http';
import { sendLinkMail } from '../mail/mailer';
import { mailContent } from '../mail/templates';
import { MAX_PHOTO_UPLOAD, deletePhoto, savePhoto } from '../photos';
import { checkInviteForRegister, closeInvitesFor, completeInviteRegistration } from '../invites/service';
import { emailSchema } from './schemas';
import { verifyCaptcha } from './captcha';
import { consumeEmailToken, createEmailToken, purgeUnverifiedAccounts } from './emailTokens';
import { publicUserSelect, requireAuth, signToken } from './middleware';
import { clientIp, emailLimiter, loginLimiter, registerLimiter, tokenLimiter } from './rateLimit';

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, punto, guion y guion bajo');
const passwordSchema = z.string().min(6).max(128);
const localeSchema = z.enum(SUPPORTED_LOCALES);
export { emailSchema };

export const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  captchaToken: z.string().max(4096).optional(),
  /** Idioma de la app al registrarse (para los correos). */
  locale: localeSchema.optional(),
  /** Token del enlace de una invitacion por correo (docs/specs/email-invitations.md). */
  inviteToken: z.string().min(10).max(200).optional(),
});

/** Usuario o correo. Los usuarios no pueden tener "@", asi que no hay ambiguedad. */
const identifierSchema = z.string().trim().min(3).max(254);
const loginSchema = z
  .object({ identifier: identifierSchema.optional(), username: identifierSchema.optional(), password: z.string().min(1).max(128) })
  .refine((d) => d.identifier ?? d.username, { message: 'Ingresa tu usuario o correo', path: ['identifier'] });

const findByIdentifier = (identifier: string) =>
  identifier.includes('@')
    ? prisma.user.findUnique({ where: { email: identifier.trim().toLowerCase() } })
    : prisma.user.findUnique({ where: { username: identifier.trim() } });

const link = (path: string, token: string) => `${env.appUrl}${path}?token=${encodeURIComponent(token)}`;

/** Un fallo de envio no debe romper la respuesta: el usuario puede pedir otro correo. */
async function trySend(send: () => Promise<void>) {
  try {
    await send();
    return true;
  } catch (err) {
    console.error('✉️  No se pudo enviar el correo:', err);
    return false;
  }
}

async function sendVerification(user: Pick<User, 'id' | 'username' | 'locale'>, email: string) {
  const token = await createEmailToken(user.id, 'VERIFY_EMAIL', email);
  return trySend(() =>
    sendLinkMail(email, mailContent('verifyEmail', user.username, user.locale), link('/verify-email', token)),
  );
}

/** Respuesta para pedidos que no deben revelar si la cuenta existe (CO-04). */
const GENERIC_MAIL_RESPONSE = {
  message: 'Si los datos corresponden a una cuenta, te enviamos un correo. Revisa tu bandeja de entrada y el spam.',
};

export const authRouter = Router();

/**
 * Registro publico: la cuenta nace sin confirmar y no recibe token. Se activa con el enlace que
 * llega por correo (ya no hace falta que un ADMIN la apruebe).
 */
authRouter.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password, captchaToken, locale, inviteToken } = registerSchema.parse(req.body);
  await verifyCaptcha(captchaToken, clientIp(req));
  // Con enlace de invitacion: debe estar vigente y ser para este correo.
  const invite = inviteToken ? await checkInviteForRegister(inviteToken, email) : null;
  await purgeUnverifiedAccounts(); // libera usuarios y correos de registros viejos sin confirmar
  if (await prisma.user.findUnique({ where: { username } })) {
    throw new HttpError(409, 'Ese nombre de usuario ya está en uso', 'USERNAME_TAKEN');
  }
  if (await prisma.user.findFirst({ where: { OR: [{ email }, { pendingEmail: email }] } })) {
    throw new HttpError(409, 'Ese correo ya está registrado', 'EMAIL_TAKEN');
  }
  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'PLAYER',
      isActive: true,
      ...(locale && { locale }),
      // El enlace llego a ese correo: la cuenta nace confirmada y con credito para quien invito (D5, D6).
      ...(invite && { emailVerifiedAt: new Date(), invitedById: invite.fromUserId }),
    },
  });
  if (invite) {
    const game = await completeInviteRegistration(invite, user.id);
    const session = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: publicUserSelect });
    return res.status(201).json({ token: signToken(user.id), user: session, ...(game !== null && { gameAvailable: game }) });
  }
  const sent = await sendVerification(user, email);
  res.status(201).json({
    pending: true,
    message: sent
      ? `Te enviamos un correo a ${email}. Abre el enlace para activar tu pasaporte.`
      : 'Tu cuenta quedó creada, pero no pudimos enviar el correo. Intenta iniciar sesión para pedir otro.',
  });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  const found = await findByIdentifier((parsed.identifier ?? parsed.username)!);
  if (!found || !(await bcrypt.compare(parsed.password, found.passwordHash))) {
    throw new HttpError(401, 'Usuario o contraseña incorrectos', 'INVALID_CREDENTIALS');
  }
  if (!found.isActive) {
    throw new HttpError(
      403,
      'Tu cuenta está desactivada o pendiente de aprobación. Contacta a un administrador.',
      'ACCOUNT_INACTIVE',
    );
  }
  if (found.email && !found.emailVerifiedAt) {
    throw new HttpError(403, 'Confirma tu correo para entrar. Revisa tu bandeja de entrada.', 'EMAIL_NOT_VERIFIED');
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: found.id }, select: publicUserSelect });
  res.json({ token: signToken(user.id), user });
});

/** Abre el enlace del correo: confirma el registro o el cambio de correo. */
authRouter.post('/verify-email', tokenLimiter, async (req, res) => {
  const { token } = z.object({ token: z.string().min(10).max(200) }).parse(req.body);
  const row = await consumeEmailToken(token, ['VERIFY_EMAIL', 'CHANGE_EMAIL']);
  if (row.purpose === 'CHANGE_EMAIL') {
    const taken = await prisma.user.findFirst({ where: { email: row.email, NOT: { id: row.userId } } });
    if (taken) throw new HttpError(409, 'Ese correo ya está registrado en otra cuenta', 'EMAIL_TAKEN');
    await prisma.user.update({
      where: { id: row.userId },
      data: { email: row.email, emailVerifiedAt: new Date(), pendingEmail: null },
    });
  } else {
    await prisma.user.updateMany({
      where: { id: row.userId, email: row.email, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }
  await closeInvitesFor(row.email);
  res.json({ ok: true, purpose: row.purpose });
});

authRouter.post('/resend-verification', emailLimiter, async (req, res) => {
  const { identifier } = z.object({ identifier: identifierSchema }).parse(req.body);
  const user = await findByIdentifier(identifier);
  if (user?.email && !user.emailVerifiedAt && user.isActive) await sendVerification(user, user.email);
  res.json(GENERIC_MAIL_RESPONSE);
});

authRouter.post('/forgot-password', emailLimiter, async (req, res) => {
  const { identifier } = z.object({ identifier: identifierSchema }).parse(req.body);
  const user = await findByIdentifier(identifier);
  if (user?.email && user.isActive) {
    const email = user.email;
    const token = await createEmailToken(user.id, 'RESET_PASSWORD', email);
    await trySend(() =>
      sendLinkMail(email, mailContent('resetPassword', user.username, user.locale), link('/reset-password', token)),
    );
  }
  res.json(GENERIC_MAIL_RESPONSE);
});

authRouter.post('/reset-password', tokenLimiter, async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(10).max(200), password: passwordSchema }).parse(req.body);
  const row = await consumeEmailToken(token, ['RESET_PASSWORD']);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId } });
  await prisma.user.update({
    where: { id: row.userId },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      // El enlace llego a su correo: eso tambien lo confirma (CO-10).
      ...(user.email === row.email && !user.emailVerifiedAt && { emailVerifiedAt: new Date() }),
    },
  });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/** Mi perfil: estilo visual, contraseña (con la actual) y correo (con la contraseña actual). */
const profileSchema = z
  .object({
    theme: z.enum(['COMIC', 'RETRO']).optional(),
    locale: localeSchema.optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: passwordSchema.optional(),
    email: emailSchema.optional(),
  })
  .refine((d) => !(d.newPassword || d.email) || d.currentPassword, {
    message: 'Ingresa tu contraseña actual',
    path: ['currentPassword'],
  });

authRouter.patch('/me', requireAuth, async (req, res) => {
  const { theme, locale, currentPassword, newPassword, email } = profileSchema.parse(req.body);
  const found = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const changingEmail = email !== undefined && email !== found.email;
  if ((newPassword || changingEmail) && !(await bcrypt.compare(currentPassword!, found.passwordHash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta', 'WRONG_PASSWORD');
  }
  if (changingEmail) {
    const taken = await prisma.user.findFirst({ where: { OR: [{ email }, { pendingEmail: email }], NOT: { id: found.id } } });
    if (taken) throw new HttpError(409, 'Ese correo ya está registrado', 'EMAIL_TAKEN');
  }
  const user = await prisma.user.update({
    where: { id: found.id },
    data: {
      ...(theme && { theme }),
      ...(locale && { locale }),
      ...(newPassword && { passwordHash: await bcrypt.hash(newPassword, 10) }),
      // El correo nuevo queda pendiente hasta abrir el enlace; mientras, vale el anterior.
      ...(changingEmail && { pendingEmail: email }),
    },
    select: publicUserSelect,
  });
  if (changingEmail) {
    const token = await createEmailToken(found.id, 'CHANGE_EMAIL', email);
    await trySend(() =>
      sendLinkMail(email, mailContent('changeEmail', found.username, locale ?? found.locale), link('/verify-email', token)),
    );
  }
  res.json({ user });
});

/** Foto del pasaporte: el cuerpo es la imagen tal cual (image/*). El servidor la normaliza. */
authRouter.put('/me/photo', requireAuth, express.raw({ type: 'image/*', limit: MAX_PHOTO_UPLOAD }), async (req, res) => {
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  res.json({ user: await savePhoto(req.user!.id, body) });
});

authRouter.delete('/me/photo', requireAuth, async (req, res) => {
  res.json({ user: await deletePhoto(req.user!.id) });
});
