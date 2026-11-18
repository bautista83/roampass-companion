import type { Prisma } from '@prisma/client';
import type { OnlineGameState } from '@roampass/shared';
import { prisma } from '../db';
import { HttpError } from '../http';

export async function loadOnline(sessionId: string): Promise<{ state: OnlineGameState; version: number; hostId: string }> {
  const row = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { state: true, version: true, kind: true, hostId: true } });
  if (!row || row.kind !== 'ONLINE') throw new HttpError(404, 'La partida no existe', 'GAME_NOT_FOUND');
  return { state: row.state as unknown as OnlineGameState, version: row.version, hostId: row.hostId };
}

const statusOf = (s: OnlineGameState) => (s.status === 'FINISHED' ? 'FINISHED' : s.online.phase === 'LOBBY' ? 'LOBBY' : 'PLAYING');

/** Filas planas de jugadores (para estadisticas y "Ultimas partidas"). No toca hiddenAt. */
function playerRows(s: OnlineGameState) {
  const winners = new Set(s.winnerIds ?? []);
  return s.players.map((p, i) => ({
    turnOrder: i,
    userId: s.online.userIds[i]!,
    name: p.name,
    color: p.color,
    avatar: p.avatar,
    score: p.score,
    isWinner: winners.has(p.id),
    stats: p.stats as unknown as Prisma.InputJsonObject,
  }));
}

/** Crea la partida (sala) en la BD. */
export async function createOnline(state: OnlineGameState, hostId: string) {
  await prisma.gameSession.create({
    data: {
      id: state.id,
      hostId,
      kind: 'ONLINE',
      victoryMode: state.config.mode,
      target: state.config.target,
      status: statusOf(state),
      state: state as unknown as Prisma.InputJsonObject,
      players: { create: playerRows(state) },
    },
  });
}

/**
 * Guarda el estado con control de version: si otro proceso lo cambio en el medio, falla
 * (VERSION_CONFLICT) y la accion se descarta.
 */
export async function saveOnline(state: OnlineGameState, version: number): Promise<number> {
  const rows = playerRows(state);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.gameSession.updateMany({
      where: { id: state.id, version },
      data: {
        version: version + 1,
        status: statusOf(state),
        currentRound: state.round,
        currentPlayerIndex: state.currentPlayerIndex,
        state: state as unknown as Prisma.InputJsonObject,
        finishedAt: state.finishedAt ? new Date(state.finishedAt) : null,
      },
    });
    if (count === 0) throw new HttpError(409, 'La partida cambió mientras tanto. Vuelve a intentar.', 'VERSION_CONFLICT');
    for (const row of rows) {
      await tx.player.upsert({
        where: { sessionId_turnOrder: { sessionId: state.id, turnOrder: row.turnOrder } },
        create: { ...row, sessionId: state.id },
        update: row,
      });
    }
    await tx.player.deleteMany({ where: { sessionId: state.id, turnOrder: { gte: rows.length } } });
  });
  return version + 1;
}
