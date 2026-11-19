// Invitaciones por correo: a una partida online o "invitar a un amigo".
// Ver docs/specs/email-invitations.md. Nunca se revela si un correo tiene cuenta (D1).

import { createHash, randomBytes } from 'node:crypto';
import type { EmailInvite } from '@prisma/client';
import { maxInitialMiles, type OnlineGameState } from '@roampass/shared';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../http';
import { sendLinkMail } from '../mail/mailer';
import { inviteMailContent } from '../mail/templates';
import { createGameInvite, hostUserId } from '../online/routes';
import { loadOnline } from '../online/store';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Vigencia del enlace (D7). La de partida ademas depende de que la partida siga. */
export const EMAIL_INVITE_TTL_MS = 7 * DAY;
/** Invitaciones por correo que manda un usuario por dia, sumando ambos tipos (D8). */
export const DAILY_INVITES_PER_USER = 10;
/** Invitaciones que recibe un mismo correo por dia, de cualquier usuario (D8). */
export const DAILY_INVITES_PER_EMAIL = 3;

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const invalid = () => new HttpError(400, 'La invitación no es válida o ya venció.', 'INVALID_INVITE');
const link = (path: string, token: string) => `${env.appUrl}${path}?token=${encodeURIComponent(token)}`;

/** Marca como vencidas las invitaciones pendientes viejas. */
export async function expireEmailInvites() {
  await prisma.emailInvite.updateMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
}

interface SendOptions {
  from: { id: string; username: string };
  email: string;
  /** Invitacion a una partida online (si falta, es de amigo). */
  game?: { state: OnlineGameState; initialMiles: number };
}

/**
 * Crea y envia una invitacion por correo. Para quien invita la respuesta es siempre la misma
 * ("enviada"), salvo los limites propios (INVITE_LIMIT) o invitarse a si mismo.
 */
export async function sendEmailInvite({ from, email, game }: SendOptions): Promise<void> {
  const sender = await prisma.user.findUniqueOrThrow({ where: { id: from.id }, select: { email: true } });
  if (sender.email === email) throw new HttpError(400, 'No puedes invitarte a ti mismo.', 'CANNOT_INVITE_SELF');

  await expireEmailInvites();
  const since = new Date(Date.now() - DAY);
  const [sentToday, sameEmail] = await Promise.all([
    prisma.emailInvite.count({ where: { fromUserId: from.id, createdAt: { gte: since } } }),
    prisma.emailInvite.count({ where: { fromUserId: from.id, email, createdAt: { gte: since } } }),
  ]);
  if (sentToday >= DAILY_INVITES_PER_USER || sameEmail > 0) {
    throw new HttpError(429, 'Llegaste al límite de invitaciones por hoy. Prueba mañana.', 'INVITE_LIMIT');
  }

  const [optedOut, receivedToday, member] = await Promise.all([
    prisma.emailOptOut.findUnique({ where: { emailHash: sha256(email) } }),
    prisma.emailInvite.count({ where: { email, createdAt: { gte: since } } }),
    prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true, emailVerifiedAt: true } }),
  ]);

  const token = randomBytes(32).toString('base64url');
  const status: EmailInvite['status'] =
    optedOut || receivedToday >= DAILY_INVITES_PER_EMAIL ? 'BLOCKED' : member ? 'ALREADY_MEMBER' : 'PENDING';
  const invite = await prisma.emailInvite.create({
    data: {
      kind: game ? 'GAME' : 'FRIEND',
      fromUserId: from.id,
      fromUsername: from.username,
      email,
      sessionId: game?.state.id ?? null,
      initialMiles: game?.initialMiles ?? 0,
      tokenHash: sha256(token),
      status,
      expiresAt: new Date(Date.now() + EMAIL_INVITE_TTL_MS),
    },
  });
  if (status === 'BLOCKED') return;

  if (status === 'ALREADY_MEMBER') {
    // De amigo no tiene sentido (D3). De partida: invitacion normal en la app + aviso por correo (D2).
    if (!game || !member!.isActive || !member!.emailVerifiedAt) return;
    try {
      await createGameInvite(game.state, from.id, member!.id, game.initialMiles, email);
    } catch {
      return; // ya esta en la partida, en otra, o ya invitado: no se revela nada
    }
    await trySend(() =>
      sendLinkMail(email, inviteMailContent('gameInviteMember', from.username), `${env.appUrl}/`, link('/invite/opt-out', token)),
    );
    return;
  }

  try {
    await sendLinkMail(
      email,
      inviteMailContent(game ? 'gameInvite' : 'friendInvite', from.username),
      link('/invite', token),
      link('/invite/opt-out', token),
    );
  } catch (err) {
    console.error('✉️  No se pudo enviar la invitación:', err);
    await prisma.emailInvite.delete({ where: { id: invite.id } });
    throw new HttpError(502, 'No pudimos enviar el correo. Prueba de nuevo en un momento.', 'MAIL_FAILED');
  }
}

async function trySend(send: () => Promise<void>) {
  try {
    await send();
  } catch (err) {
    console.error('✉️  No se pudo enviar el aviso de invitación:', err);
  }
}

/** Invitacion pendiente y vigente por su token, o error INVALID_INVITE. */
async function pendingByToken(token: string) {
  await expireEmailInvites();
  const invite = await prisma.emailInvite.findUnique({ where: { tokenHash: sha256(token) } });
  if (!invite || invite.status !== 'PENDING') throw invalid();
  return invite;
}

/** La partida de la invitacion sigue y tiene lugar (para mostrarlo antes de registrarse). */
async function gameAvailable(invite: EmailInvite): Promise<boolean> {
  if (invite.kind !== 'GAME' || !invite.sessionId) return false;
  try {
    const { state } = await loadOnline(invite.sessionId);
    return state.status !== 'FINISHED';
  } catch {
    return false;
  }
}

/** Datos publicos de la invitacion para la pagina de registro. */
export async function describeInvite(token: string) {
  const invite = await pendingByToken(token);
  return {
    email: invite.email,
    fromUsername: invite.fromUsername,
    kind: invite.kind,
    gameAvailable: await gameAvailable(invite),
  };
}

/** Valida el token antes de crear la cuenta: debe estar vigente y ser para ese correo. */
export async function checkInviteForRegister(token: string, email: string) {
  const invite = await pendingByToken(token);
  if (invite.email !== email) {
    throw new HttpError(400, 'Esta invitación es para otro correo.', 'INVITE_EMAIL_MISMATCH');
  }
  return invite;
}

/**
 * Despues de crear la cuenta con el enlace: la invitacion queda REGISTERED (credito para quien
 * invito, D6), las demas a ese correo quedan CLOSED y, si era de partida y sigue, se crea la
 * invitacion de partida normal (EI-06). Devuelve si la partida esta disponible.
 */
export async function completeInviteRegistration(invite: EmailInvite, userId: string): Promise<boolean | null> {
  const { count } = await prisma.emailInvite.updateMany({
    where: { id: invite.id, status: 'PENDING' },
    data: { status: 'REGISTERED', registeredUserId: userId, registeredAt: new Date() },
  });
  if (count === 0) throw invalid();
  await closeInvitesFor(invite.email);
  if (invite.kind !== 'GAME') return null;
  if (!invite.sessionId) return false;
  try {
    const { state } = await loadOnline(invite.sessionId);
    if (state.status === 'FINISHED') return false;
    const miles = state.online.phase === 'LOBBY' ? 0 : Math.min(invite.initialMiles, maxInitialMiles(state));
    await createGameInvite(state, hostUserId(state), userId, miles - (miles % 500), invite.email);
    return true;
  } catch {
    return false;
  }
}

/** El correo ya tiene cuenta (por otra invitacion o registro normal): las pendientes se cierran (D6). */
export async function closeInvitesFor(email: string) {
  await prisma.emailInvite.updateMany({ where: { email, status: 'PENDING' }, data: { status: 'CLOSED' } });
}

/** "No quiero recibir invitaciones" (D9): vale cualquier enlace de invitacion que haya llegado. */
export async function optOut(token: string) {
  const invite = await prisma.emailInvite.findUnique({ where: { tokenHash: sha256(token) }, select: { email: true } });
  if (!invite) throw invalid();
  const emailHash = sha256(invite.email);
  await prisma.emailOptOut.upsert({ where: { emailHash }, create: { emailHash }, update: {} });
}

export type MyInviteStatus = 'PENDING' | 'REGISTERED' | 'EXPIRED';

/** "Mis invitaciones": los estados internos se muestran como pendientes hasta vencer (D1, 4.3). */
export async function myInvites(userId: string) {
  const rows = await prisma.emailInvite.findMany({
    where: { fromUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, kind: true, email: true, status: true, createdAt: true, expiresAt: true, registeredUser: { select: { username: true } } },
  });
  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    email: r.email,
    createdAt: r.createdAt,
    status: (r.status === 'REGISTERED' ? 'REGISTERED' : r.expiresAt < now || r.status === 'EXPIRED' ? 'EXPIRED' : 'PENDING') as MyInviteStatus,
    registeredUsername: r.status === 'REGISTERED' ? (r.registeredUser?.username ?? null) : null,
  }));
}

/**
 * Invitaciones por correo de una sala, para la lista de la sala: se muestran todas igual (con el
 * correo) hasta que esa persona se sienta en la partida (D1, D2).
 */
export async function sessionEmailInvites(state: OnlineGameState) {
  const rows = await prisma.emailInvite.findMany({
    where: { sessionId: state.id, status: { not: 'EXPIRED' }, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!rows.length) return [];
  const seated = await prisma.user.findMany({ where: { id: { in: state.online.userIds } }, select: { email: true } });
  const seatedEmails = new Set(seated.map((u) => u.email).filter(Boolean));
  return rows.filter((r) => !seatedEmails.has(r.email)).map((r) => ({ id: r.id, email: r.email, createdAt: r.createdAt }));
}
