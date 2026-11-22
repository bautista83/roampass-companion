import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  AVATARS,
  DIE_TIMEOUT_OPTIONS,
  MAX_PLAYERS,
  PAWN_COLORS,
  POINT_TARGETS,
  ROUND_TARGETS,
  TIMER_OPTIONS,
  addPlayer,
  createOnlineGame,
  leaveLobby,
  maxInitialMiles,
  playerIdOfUser,
  seatedPlayers,
  setPresence,
  type InviteSummary,
  type OnlineGameState,
} from '@roampass/shared';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../http';
import { requireAuth } from '../auth/middleware';
import { clientIp, inviteLimiter } from '../auth/rateLimit';
import { emailSchema } from '../auth/schemas';
import { sendEmailInvite, sessionEmailInvites } from '../invites/service';
import { ipKeyGenerator } from 'express-rate-limit';
import { onlineService } from './service';
import { createOnline, loadOnline } from './store';
import { notifyUser } from './notify';
import { pushLater } from '../push/service';

const INVITE_TTL_MS = 10 * 60 * 1000;

export const hostUserId = (s: OnlineGameState) => s.online.userIds[s.players.findIndex((p) => p.id === s.online.hostPlayerId)]!;
const presenceOfUser = (s: OnlineGameState, userId: string) => {
  const i = s.online.userIds.indexOf(userId);
  return i === -1 ? null : (s.players[i]!.presence ?? 'ACTIVE');
};

/** Partida online en la que el usuario esta (sala o en curso, sin haber abandonado): RN-02. */
export async function activeOnlineSessionOf(userId: string): Promise<string | null> {
  const sessions = await prisma.gameSession.findMany({
    where: { kind: 'ONLINE', status: { in: ['LOBBY', 'PLAYING'] }, players: { some: { userId } } },
    select: { id: true, state: true },
    orderBy: { updatedAt: 'desc' },
  });
  for (const s of sessions) {
    const p = presenceOfUser(s.state as unknown as OnlineGameState, userId);
    if (p && p !== 'ABANDONED') return s.id;
  }
  return null;
}

async function requireFree(userId: string, message: string) {
  if (await activeOnlineSessionOf(userId)) throw new HttpError(409, message, 'ALREADY_IN_ONLINE_GAME');
}

function participant(s: OnlineGameState, userId: string) {
  if (!s.online.userIds.includes(userId)) throw new HttpError(403, 'No participas en esta partida', 'NOT_IN_GAME');
}

/** Marca como vencidas las invitaciones pendientes viejas (RN-04). */
export async function expireInvites() {
  await prisma.gameInvite.updateMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
}

async function inviteSummary(inviteId: string): Promise<InviteSummary> {
  const inv = await prisma.gameInvite.findUniqueOrThrow({
    where: { id: inviteId },
    include: { fromUser: { select: { username: true } }, session: { select: { state: true } } },
  });
  const s = inv.session.state as unknown as OnlineGameState;
  return {
    id: inv.id,
    sessionId: inv.sessionId,
    from: inv.fromUser.username,
    started: s.online.phase !== 'LOBBY',
    initialMiles: inv.initialMiles,
    mode: s.config.mode,
    target: s.config.target,
    players: s.players.map((p) => ({ name: p.name, color: p.color, avatar: p.avatar })),
    takenColors: s.players.map((p) => p.color),
    expiresAt: inv.expiresAt.toISOString(),
  };
}

// ── Busqueda de usuarios (para invitar) ─────────────────────────────────────

export const userSearchRouter = Router();
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
  message: { error: 'Demasiadas búsquedas. Espera un momento.', code: 'RATE_LIMITED' },
});

/** Hasta 10 usuarios activos cuyo nombre empieza con `q` (minimo 2 letras). Solo { id, username }. */
userSearchRouter.get('/search', requireAuth, searchLimiter, async (req, res) => {
  const q = z.string().trim().min(2).max(24).regex(/^[a-zA-Z0-9_.-]+$/).safeParse(req.query.q);
  if (!q.success) return res.json({ users: [] });
  const users = await prisma.user.findMany({
    where: {
      username: { startsWith: q.data, mode: 'insensitive' },
      isActive: true,
      NOT: { id: req.user!.id },
      OR: [{ email: null }, { emailVerifiedAt: { not: null } }],
    },
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
    take: 10,
  });
  res.json({ users });
});

// ── Salas ───────────────────────────────────────────────────────────────────

export const onlineRouter = Router();
onlineRouter.use(requireAuth);

const setupSchema = z.object({ color: z.enum(PAWN_COLORS), avatar: z.enum(AVATARS) });
const createSchema = setupSchema.extend({
  mode: z.enum(['POINTS', 'ROUNDS']),
  target: z.number().int(),
  timerSeconds: z.number().int().refine((n) => (TIMER_OPTIONS as readonly number[]).includes(n)),
  dieTimeoutSeconds: z.number().int().refine((n) => (DIE_TIMEOUT_OPTIONS as readonly number[]).includes(n)),
});

/** Crea la sala; quien la crea es el anfitrion (5.1). */
onlineRouter.post('/', async (req, res) => {
  const body = createSchema.parse(req.body);
  const targets: readonly number[] = body.mode === 'POINTS' ? POINT_TARGETS : ROUND_TARGETS;
  if (!targets.includes(body.target)) throw new HttpError(400, 'Meta inválida', 'INVALID_TARGET');
  await requireFree(req.user!.id, 'Ya estás en otra partida online');
  const state = createOnlineGame({
    id: `on-${randomUUID()}`,
    config: { mode: body.mode, target: body.target },
    timerSeconds: body.timerSeconds,
    dieTimeoutSeconds: body.dieTimeoutSeconds,
    host: { userId: req.user!.id, setup: { name: req.user!.username, color: body.color, avatar: body.avatar } },
  });
  await createOnline(state, req.user!.id);
  res.status(201).json({ sessionId: state.id });
});

/** Partida online actual del usuario (para el boton "Continuar"). */
onlineRouter.get('/current', async (req, res) => {
  const sessionId = await activeOnlineSessionOf(req.user!.id);
  if (!sessionId) return res.json({ current: null });
  const { state } = await loadOnline(sessionId);
  res.json({ current: { sessionId, phase: state.online.phase, round: state.round } });
});

/** El anfitrion cancela la sala (solo antes de empezar). */
onlineRouter.delete('/:id', async (req, res) => {
  const { state } = await loadOnline(String(req.params.id));
  if (hostUserId(state) !== req.user!.id) throw new HttpError(403, 'Solo el anfitrión puede cancelar la sala', 'NOT_HOST');
  if (state.online.phase !== 'LOBBY') throw new HttpError(400, 'La partida ya empezó', 'WRONG_PHASE');
  const pending = await prisma.gameInvite.findMany({ where: { sessionId: state.id, status: 'PENDING' }, select: { id: true, toUserId: true } });
  await prisma.gameSession.delete({ where: { id: state.id } });
  for (const inv of pending) notifyUser(inv.toUserId, 'invite:updated', { id: inv.id, sessionId: state.id, status: 'CANCELLED', username: req.user!.username });
  onlineService.closed(state.id);
  res.status(204).end();
});

/** Un invitado sale de la sala antes de que empiece. */
onlineRouter.post('/:id/leave', async (req, res) => {
  await onlineService.act(String(req.params.id), (s) => leaveLobby(s, req.user!.id));
  res.status(204).end();
});

const inviteSchema = z.object({ toUserId: z.string().min(1), initialMiles: z.number().int().min(0).default(0) });

/** El anfitrion manda una invitacion de partida (valida y avisa al invitado en tiempo real). */
export async function createGameInvite(
  state: OnlineGameState,
  fromUserId: string,
  toUserId: string,
  initialMiles: number,
  viaEmail?: string,
): Promise<string> {
  if (state.status === 'FINISHED') throw new HttpError(400, 'La partida ya terminó', 'GAME_FINISHED');
  if (state.online.userIds.includes(toUserId)) throw new HttpError(409, 'Ese usuario ya está en la partida', 'ALREADY_IN_GAME');
  const target = await prisma.user.findUnique({ where: { id: toUserId }, select: { isActive: true, username: true } });
  if (!target?.isActive) throw new HttpError(404, 'Usuario no encontrado', 'NOT_FOUND');
  if (state.online.phase !== 'LOBBY' && (initialMiles % 500 !== 0 || initialMiles > maxInitialMiles(state))) {
    throw new HttpError(400, 'Millas iniciales inválidas', 'INVALID_INITIAL_MILES');
  }
  await requireFree(toUserId, 'Ese usuario ya está en otra partida online');
  await expireInvites();
  const existing = await prisma.gameInvite.findFirst({ where: { sessionId: state.id, toUserId, status: 'PENDING' } });
  if (existing) throw new HttpError(409, 'Ya invitaste a ese usuario', 'ALREADY_INVITED');
  const invite = await prisma.gameInvite.create({
    data: {
      sessionId: state.id,
      fromUserId,
      toUserId,
      initialMiles: state.online.phase === 'LOBBY' ? 0 : initialMiles,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      viaEmail: viaEmail ?? null,
    },
  });
  const summary = await inviteSummary(invite.id);
  notifyUser(toUserId, 'invite:received', summary);
  pushLater(toUserId, 'GAME_INVITE', {
    params: { from: summary.from },
    link: '/',
    tag: `invite-${invite.id}`,
    ttlSeconds: INVITE_TTL_MS / 1000,
  });
  return invite.id;
}

/** Solo el anfitrion invita, y no con la partida terminada ni completa. */
export function requireHostCanInvite(state: OnlineGameState, userId: string) {
  if (hostUserId(state) !== userId) throw new HttpError(403, 'Solo el anfitrión puede invitar', 'NOT_HOST');
  if (state.status === 'FINISHED') throw new HttpError(400, 'La partida ya terminó', 'GAME_FINISHED');
  if (seatedPlayers(state).length >= MAX_PLAYERS) throw new HttpError(400, 'La partida ya tiene el máximo de jugadores', 'GAME_FULL');
}

/** El anfitrion invita (tambien con la partida en curso, con millas iniciales): RN-05, 5.6. */
onlineRouter.post('/:id/invites', async (req, res) => {
  const { toUserId, initialMiles } = inviteSchema.parse(req.body);
  const { state } = await loadOnline(String(req.params.id));
  if (hostUserId(state) !== req.user!.id) throw new HttpError(403, 'Solo el anfitrión puede invitar', 'NOT_HOST');
  const id = await createGameInvite(state, req.user!.id, toUserId, initialMiles);
  res.status(201).json({ id });
});

const emailInviteSchema = z.object({ email: emailSchema, initialMiles: z.number().int().min(0).default(0) });

/** Invitacion a la partida por correo (docs/specs/email-invitations.md, 4.1). */
onlineRouter.post('/:id/email-invites', inviteLimiter, async (req, res) => {
  const { email, initialMiles } = emailInviteSchema.parse(req.body);
  const { state } = await loadOnline(String(req.params.id));
  requireHostCanInvite(state, req.user!.id);
  if (state.online.phase !== 'LOBBY' && (initialMiles % 500 !== 0 || initialMiles > maxInitialMiles(state))) {
    throw new HttpError(400, 'Millas iniciales inválidas', 'INVALID_INITIAL_MILES');
  }
  await sendEmailInvite({
    from: req.user!,
    email,
    game: { state, initialMiles: state.online.phase === 'LOBBY' ? 0 : initialMiles },
  });
  res.status(201).json({ sent: true });
});

/** Invitaciones pendientes que mando el anfitrion en esta partida (para la sala de espera). */
onlineRouter.get('/:id/invites', async (req, res) => {
  const { state } = await loadOnline(String(req.params.id));
  participant(state, req.user!.id);
  await expireInvites();
  const invites = await prisma.gameInvite.findMany({
    // Las que nacieron de un correo se muestran en la lista de correos (no revelan el usuario).
    where: { sessionId: state.id, status: 'PENDING', viaEmail: null },
    select: { id: true, initialMiles: true, expiresAt: true, toUser: { select: { username: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({
    invites: invites.map((i) => ({ id: i.id, username: i.toUser.username, initialMiles: i.initialMiles, expiresAt: i.expiresAt })),
    emails: await sessionEmailInvites(state),
  });
});

/** Volver a una partida que se abandono, con las millas que tenia (5.5). */
onlineRouter.post('/:id/rejoin', async (req, res) => {
  const sessionId = String(req.params.id);
  const other = await activeOnlineSessionOf(req.user!.id);
  if (other && other !== sessionId) throw new HttpError(409, 'Ya estás en otra partida online', 'ALREADY_IN_ONLINE_GAME');
  await onlineService.act(sessionId, (s, deck) => setPresence(s, deck, req.user!.id, 'ACTIVE'));
  res.status(204).end();
});

/** Ocultar de mi panel. En curso equivale a abandonar; en la sala, salir (RN-21, CA-29). */
onlineRouter.post('/:id/hide', async (req, res) => {
  const sessionId = String(req.params.id);
  const { state } = await loadOnline(sessionId);
  participant(state, req.user!.id);
  if (state.online.phase === 'LOBBY') {
    if (hostUserId(state) === req.user!.id) throw new HttpError(400, 'Cancela la sala en lugar de ocultarla', 'NOT_HOST');
    await onlineService.act(sessionId, (s) => leaveLobby(s, req.user!.id));
    return res.status(204).end();
  }
  if (state.status !== 'FINISHED' && presenceOfUser(state, req.user!.id) !== 'ABANDONED') {
    await onlineService.act(sessionId, (s, deck) => setPresence(s, deck, req.user!.id, 'ABANDONED'));
  }
  await prisma.player.updateMany({ where: { sessionId, userId: req.user!.id }, data: { hiddenAt: new Date() } });
  res.status(204).end();
});

/**
 * Foto fija de Street View para quien NO tiene el turno (no expone las coordenadas): proxy de la
 * Street View Static API con la clave del servidor (5.4, 9.2).
 */
onlineRouter.get('/:id/streetview-photo', async (req, res) => {
  const { state } = await loadOnline(String(req.params.id));
  participant(state, req.user!.id);
  const pending = state.online.pending;
  if (!pending || state.online.phase !== 'AWAITING_ANSWER' || !env.googleMapsKey) throw new HttpError(404, 'Sin foto', 'NOT_FOUND');
  const deck = await (await import('./deck')).onlineDeck();
  const card = deck.find((c) => c.id === pending.cardId);
  if (!card || card.category !== 'LOCATION' || card.imageUrl) throw new HttpError(404, 'Sin foto', 'NOT_FOUND');
  const url = new URL('https://maps.googleapis.com/maps/api/streetview');
  url.search = new URLSearchParams({
    size: '640x400',
    location: `${card.location.lat},${card.location.lng}`,
    fov: '90',
    source: 'outdoor',
    key: env.googleMapsKey,
  }).toString();
  const upstream = await fetch(url);
  if (!upstream.ok) throw new HttpError(502, 'No se pudo obtener la foto', 'INTERNAL');
  res.set('Cache-Control', 'private, max-age=300');
  res.type(upstream.headers.get('content-type') ?? 'image/jpeg').send(Buffer.from(await upstream.arrayBuffer()));
});

// ── Invitaciones recibidas ──────────────────────────────────────────────────

export const invitesRouter = Router();
invitesRouter.use(requireAuth);

invitesRouter.get('/', async (req, res) => {
  await expireInvites();
  const invites = await prisma.gameInvite.findMany({
    where: { toUserId: req.user!.id, status: 'PENDING' },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ invites: await Promise.all(invites.map((i) => inviteSummary(i.id))) });
});

async function pendingInviteFor(inviteId: string, userId: string) {
  await expireInvites();
  const inv = await prisma.gameInvite.findUnique({ where: { id: inviteId }, include: { fromUser: { select: { username: true } } } });
  if (!inv || inv.toUserId !== userId) throw new HttpError(404, 'Invitación no encontrada', 'NOT_FOUND');
  if (inv.status !== 'PENDING') throw new HttpError(410, 'La invitación ya no es válida', 'INVITE_EXPIRED');
  return inv;
}

invitesRouter.post('/:id/accept', async (req, res) => {
  const { color, avatar } = setupSchema.parse(req.body);
  const inv = await pendingInviteFor(String(req.params.id), req.user!.id);
  await requireFree(req.user!.id, 'Ya estás en otra partida online');
  await onlineService.act(inv.sessionId, (s) => addPlayer(s, req.user!.id, { name: req.user!.username, color, avatar }, inv.initialMiles));
  await prisma.gameInvite.update({ where: { id: inv.id }, data: { status: 'ACCEPTED', respondedAt: new Date() } });
  notifyUser(inv.fromUserId, 'invite:updated', { id: inv.id, sessionId: inv.sessionId, status: 'ACCEPTED', username: req.user!.username });
  pushLater(inv.fromUserId, 'INVITE_ACCEPTED', {
    params: { username: req.user!.username },
    link: `/online/${inv.sessionId}`,
    tag: `accepted-${inv.id}`,
    ttlSeconds: 10 * 60,
  });
  res.json({ sessionId: inv.sessionId });
});

invitesRouter.post('/:id/decline', async (req, res) => {
  const inv = await pendingInviteFor(String(req.params.id), req.user!.id);
  await prisma.gameInvite.update({ where: { id: inv.id }, data: { status: 'DECLINED', respondedAt: new Date() } });
  notifyUser(inv.fromUserId, 'invite:updated', { id: inv.id, sessionId: inv.sessionId, status: 'DECLINED', username: req.user!.username });
  res.status(204).end();
});

/** El anfitrion cancela una invitacion que mando. */
invitesRouter.delete('/:id', async (req, res) => {
  const inv = await prisma.gameInvite.findUnique({ where: { id: String(req.params.id) } });
  if (!inv || inv.fromUserId !== req.user!.id) throw new HttpError(404, 'Invitación no encontrada', 'NOT_FOUND');
  if (inv.status === 'PENDING') {
    await prisma.gameInvite.update({ where: { id: inv.id }, data: { status: 'CANCELLED', respondedAt: new Date() } });
    notifyUser(inv.toUserId, 'invite:updated', { id: inv.id, sessionId: inv.sessionId, status: 'CANCELLED', username: req.user!.username });
  }
  res.status(204).end();
});

/** Cancela las invitaciones sin responder al empezar la partida (5.1). */
export async function cancelPendingInvites(sessionId: string, byUsername: string) {
  const pending = await prisma.gameInvite.findMany({ where: { sessionId, status: 'PENDING' }, select: { id: true, toUserId: true } });
  if (!pending.length) return;
  await prisma.gameInvite.updateMany({ where: { sessionId, status: 'PENDING' }, data: { status: 'CANCELLED', respondedAt: new Date() } });
  for (const inv of pending) notifyUser(inv.toUserId, 'invite:updated', { id: inv.id, sessionId, status: 'CANCELLED', username: byUsername });
}

export { playerIdOfUser };
