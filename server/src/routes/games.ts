import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { CARD_CATEGORIES, MAX_PLAYERS, MIN_PLAYERS, PAWN_COLORS, validateConfig, type GameState } from '@roampass/shared';
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
  config: z.object({ mode: z.enum(['POINTS', 'ROUNDS']), target: z.number().int() }),
  players: z.array(playerSchema).min(MIN_PLAYERS).max(MAX_PLAYERS),
  currentPlayerIndex: z.number().int().min(0),
  round: z.number().int().min(1),
  status: z.enum(['PLAYING', 'FINISHED']),
  history: z.array(z.record(z.string(), z.unknown())),
  usedCardIds: z.array(z.string()),
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
