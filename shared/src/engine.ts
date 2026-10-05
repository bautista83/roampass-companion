// Motor de partida puro (sin efectos): control de turnos, puntaje y condicion de victoria.
// El store del cliente solo envuelve estas funciones, asi que todo es testeable aislado.

import { scoreOutcome } from './scoring';
import {
  CARD_CATEGORIES,
  POINT_TARGETS,
  ROUND_TARGETS,
  type CardCategory,
  type CardOutcome,
  type GamePlayer,
  type GameState,
  type PlayerSetup,
  type PlayerStats,
  type ScoreResult,
  type VictoryCondition,
} from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

/** El marcador nunca baja de 0 (una "Visa Denegada" no deja a nadie en negativo). */
export const MIN_SCORE = 0;

export class GameRuleError extends Error {}

const emptyStats = (): PlayerStats => ({
  cardsPlayed: 0,
  correct: 0,
  wrong: 0,
  pointsByCategory: Object.fromEntries(CARD_CATEGORIES.map((c) => [c, 0])) as Record<CardCategory, number>,
  bestDistanceKm: null,
});

export function validateConfig(config: VictoryCondition): void {
  const allowed: readonly number[] = config.mode === 'POINTS' ? POINT_TARGETS : ROUND_TARGETS;
  if (!allowed.includes(config.target)) {
    throw new GameRuleError(`Objetivo invalido para ${config.mode}: ${config.target}`);
  }
}

export function validatePlayers(players: readonly PlayerSetup[]): void {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new GameRuleError(`Se requieren entre ${MIN_PLAYERS} y ${MAX_PLAYERS} jugadores`);
  }
  const names = players.map((p) => p.name.trim().toLowerCase());
  if (names.some((n) => n.length === 0)) throw new GameRuleError('Todos los jugadores necesitan nombre');
  if (new Set(names).size !== names.length) throw new GameRuleError('Los nombres deben ser unicos');
  if (new Set(players.map((p) => p.color)).size !== players.length) {
    throw new GameRuleError('Cada peon debe tener un color distinto');
  }
}

export function createGame(
  config: VictoryCondition,
  setups: readonly PlayerSetup[],
  opts: { id?: string; now?: Date } = {},
): GameState {
  validateConfig(config);
  validatePlayers(setups);
  const now = opts.now ?? new Date();
  return {
    id: opts.id ?? `game-${now.getTime().toString(36)}`,
    createdAt: now.toISOString(),
    config: { ...config },
    players: setups.map(
      (p, i): GamePlayer => ({ ...p, name: p.name.trim(), id: `p${i + 1}`, score: 0, stats: emptyStats() }),
    ),
    currentPlayerIndex: 0,
    round: 1,
    status: 'PLAYING',
    history: [],
    usedCardIds: [],
  };
}

export const currentPlayer = (state: GameState): GamePlayer => state.players[state.currentPlayerIndex]!;

/**
 * Resuelve la carta del jugador en turno y avanza al siguiente.
 * - POINTS: la partida termina en cuanto alguien alcanza el objetivo.
 * - ROUNDS: termina cuando el ultimo jugador completa la ronda objetivo.
 */
export function applyTurn(
  state: GameState,
  outcome: CardOutcome,
  now: Date = new Date(),
): { state: GameState; result: ScoreResult } {
  if (state.status === 'FINISHED') throw new GameRuleError('La partida ya termino');

  const raw = scoreOutcome(outcome);
  const player = currentPlayer(state);
  const newScore = Math.max(MIN_SCORE, player.score + raw.delta);
  const result: ScoreResult = { ...raw, delta: newScore - player.score };
  const category = outcome.card.category;

  const players = state.players.map((p, i) => {
    if (i !== state.currentPlayerIndex) return p;
    const s = p.stats;
    return {
      ...p,
      score: newScore,
      stats: {
        cardsPlayed: s.cardsPlayed + 1,
        correct: s.correct + (result.correct === true ? 1 : 0),
        wrong: s.wrong + (result.correct === false ? 1 : 0),
        pointsByCategory: { ...s.pointsByCategory, [category]: s.pointsByCategory[category] + result.delta },
        bestDistanceKm:
          result.distanceKm === undefined
            ? s.bestDistanceKm
            : Math.min(s.bestDistanceKm ?? Infinity, result.distanceKm),
      },
    };
  });

  const next: GameState = {
    ...state,
    players,
    history: [
      ...state.history,
      {
        round: state.round,
        playerId: player.id,
        category,
        cardId: outcome.card.id,
        ...('difficulty' in outcome.card && { difficulty: outcome.card.difficulty }),
        delta: result.delta,
        correct: result.correct,
        ...(result.distanceKm !== undefined && { distanceKm: result.distanceKm }),
        at: now.toISOString(),
      },
    ],
    usedCardIds: [...state.usedCardIds, outcome.card.id],
  };

  return { state: advance(next, now), result };
}

function advance(state: GameState, now: Date): GameState {
  const { mode, target } = state.config;
  if (mode === 'POINTS' && state.players.some((p) => p.score >= target)) {
    return finish(state, now);
  }

  const wraps = state.currentPlayerIndex === state.players.length - 1;
  if (wraps && mode === 'ROUNDS' && state.round >= target) {
    return finish(state, now);
  }

  return {
    ...state,
    currentPlayerIndex: wraps ? 0 : state.currentPlayerIndex + 1,
    round: wraps ? state.round + 1 : state.round,
  };
}

/** Permite cerrar la partida antes de tiempo (gana quien vaya primero). */
export function finish(state: GameState, now: Date = new Date()): GameState {
  if (state.status === 'FINISHED') return state;
  const ranking = rankPlayers(state.players);
  return {
    ...state,
    status: 'FINISHED',
    finishedAt: now.toISOString(),
    winnerIds: ranking.filter((r) => r.position === 1).map((r) => r.player.id),
  };
}

export interface RankedPlayer {
  position: number;
  player: GamePlayer;
}

/**
 * Ranking por puntos; desempata quien tenga mas aciertos.
 * Empates totales comparten posicion (1, 1, 3...).
 */
export function rankPlayers(players: readonly GamePlayer[]): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || b.stats.correct - a.stats.correct);
  return sorted.map((player, i) => {
    const firstTied = sorted.findIndex(
      (p) => p.score === player.score && p.stats.correct === player.stats.correct,
    );
    return { position: (firstTied === -1 ? i : firstTied) + 1, player };
  });
}

/** Progreso hacia la meta (0..1) para barras del marcador. */
export function progressToGoal(state: GameState, player: GamePlayer): number {
  const { mode, target } = state.config;
  if (mode === 'POINTS') return Math.min(1, player.score / target);
  const turnsDone = state.history.filter((h) => h.playerId === player.id).length;
  return Math.min(1, turnsDone / target);
}
