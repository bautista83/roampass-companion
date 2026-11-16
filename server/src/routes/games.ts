import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  CARD_CATEGORIES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PAWN_COLORS,
  validateConfig,
  validateTimer,
  type GameState,
} from '@roampass/shared';
import { prisma } from '../db';
import { HttpError } from '../http';
import { requireAuth } from '../auth/middleware';

// Validacion estructural del snapshot del motor. Las reglas (puntaje, turnos) se aplican
// en el cliente con el mismo paquete @roampass/shared: la mesa es fisica y de confianza.
const playerSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(30),
  color: z.enum(PAWN_COLORS),
  avatar: z.string().max(16),
  score: z.number().int().min(0),
  stats: z.object({
    cardsPlayed: z.number().int(),
    correct: z.number().int(),
    wrong: z.number().int(),
    pointsByCategory: z.record(z.enum(CARD_CATEGORIES as [string, ...string[]]), z.number()),
    bestDistanceKm: z.number().nullable(),
  }),
});

const stateSchema = z.object({
  id: z.string().min(1).max(64),
  createdAt: z.string(),
  config: z.object({
    mode: z.enum(['POINTS', 'ROUNDS']),
    target: z.number().int(),
    board: z.enum(['PHYSICAL', 'DIGITAL']).optional(),
  }),
  players: z.array(playerSchema).min(MIN_PLAYERS).max(MAX_PLAYERS),
  currentPlayerIndex: z.number().int().min(0),
  round: z.number().int().min(1),
  status: z.enum(['PLAYING', 'FINISHED']),
  history: z.array(z.record(z.string(), z.unknown())),
  usedCardIds: z.array(z.string()),
  timerSeconds: z.number().int().optional(),
  transportEvent: z.boolean().optional(),
  finishedAt: z.string().optional(),
  winnerIds: z.array(z.string()).optional(),
});

const syncSchema = z.object({
  state: stateSchema,
  /** Peon que controla el usuario autenticado (para su record personal), o null. */
  selfPlayerId: z.string().nullable().default(null),
});

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

/** Upsert idempotente: el cliente llama tras cada turno y al terminar la partida. */
gamesRouter.put('/:id', async (req, res) => {
  const { state, selfPlayerId } = syncSchema.parse(req.body);
  if (state.id !== req.params.id) throw new HttpError(400, 'El id no coincide');
  validateConfig(state.config);
  if (state.timerSeconds !== undefined) validateTimer(state.timerSeconds);

  const existing = await prisma.gameSession.findUnique({ where: { id: state.id }, select: { hostId: true } });
  if (existing && existing.hostId !== req.user!.id) throw new HttpError(403, 'La partida pertenece a otro usuario');

  const winners = new Set(state.winnerIds ?? []);
  const players = state.players.map((p, i) => ({
    turnOrder: i,
    name: p.name,
    color: p.color,
    avatar: p.avatar,
    score: p.score,
    isWinner: winners.has(p.id),
    stats: p.stats as Prisma.InputJsonObject,
    userId: p.id === selfPlayerId ? req.user!.id : null,
  }));
  const columns = {
    victoryMode: state.config.mode,
    target: state.config.target,
    status: state.status,
    currentRound: state.round,
    currentPlayerIndex: state.currentPlayerIndex,
    state: state as unknown as Prisma.InputJsonObject,
    finishedAt: state.finishedAt ? new Date(state.finishedAt) : null,
  };

  await prisma.$transaction([
    prisma.gameSession.upsert({
      where: { id: state.id },
      create: { id: state.id, hostId: req.user!.id, startedAt: new Date(state.createdAt), ...columns },
      update: columns,
    }),
    prisma.player.deleteMany({ where: { sessionId: state.id } }),
    prisma.player.createMany({ data: players.map((p) => ({ ...p, sessionId: state.id })) }),
  ]);
  res.status(204).end();
});

/** Ultima partida en curso del usuario, para reanudarla desde otro dispositivo. */
gamesRouter.get('/active', async (req, res) => {
  const session = await prisma.gameSession.findFirst({
    where: { hostId: req.user!.id, status: 'PLAYING' },
    orderBy: { updatedAt: 'desc' },
    select: { state: true },
  });
  res.json({ state: (session?.state ?? null) as GameState | null });
});

gamesRouter.get('/stats/me', async (req, res) => {
  const userId = req.user!.id;
  const finished = { status: 'FINISHED' as const };
  const [gamesPlayed, gamesWon, best] = await Promise.all([
    prisma.gameSession.count({
      where: { ...finished, OR: [{ hostId: userId }, { players: { some: { userId } } }] },
    }),
    prisma.player.count({ where: { userId, isWinner: true, session: finished } }),
    prisma.player.aggregate({ where: { userId, session: finished }, _max: { score: true } }),
  ]);
  res.json({ gamesPlayed, gamesWon, bestScore: best._max.score ?? 0 });
});

/** Ultimas partidas para el panel: el admin ve las de todos; cada usuario, las que creo o jugo. */
gamesRouter.get('/recent', async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(50).catch(12).parse(req.query.limit);
  const user = req.user!;
  const sessions = await prisma.gameSession.findMany({
    where: user.role === 'ADMIN' ? {} : { OR: [{ hostId: user.id }, { players: { some: { userId: user.id } } }] },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      victoryMode: true,
      target: true,
      currentRound: true,
      startedAt: true,
      finishedAt: true,
      state: true,
      hostId: true,
      host: { select: { username: true } },
      players: {
        orderBy: [{ score: 'desc' }, { turnOrder: 'asc' }],
        select: { name: true, color: true, avatar: true, score: true, isWinner: true, user: { select: { username: true } } },
      },
    },
  });
  res.json({
    games: sessions.map((s) => ({
      id: s.id,
      host: s.host.username,
      status: s.status,
      mode: s.victoryMode,
      target: s.target,
      board: (s.state as unknown as GameState).config?.board ?? 'PHYSICAL',
      round: s.currentRound,
      startedAt: s.startedAt.toISOString(),
      finishedAt: s.finishedAt?.toISOString() ?? null,
      canDelete: user.role === 'ADMIN' || s.hostId === user.id,
      players: s.players.map(({ user: u, ...p }) => ({ ...p, username: u?.username ?? null })),
    })),
  });
});

/** Elimina una partida (y sus jugadores, en cascada). Solo quien la creo o un admin. */
gamesRouter.delete('/:id', async (req, res) => {
  const session = await prisma.gameSession.findUnique({ where: { id: req.params.id }, select: { hostId: true } });
  if (!session) throw new HttpError(404, 'La partida no existe');
  if (req.user!.role !== 'ADMIN' && session.hostId !== req.user!.id) {
    throw new HttpError(403, 'Solo quien creó la partida puede eliminarla');
  }
  await prisma.gameSession.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
