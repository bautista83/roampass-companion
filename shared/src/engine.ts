// Motor de partida puro (sin efectos): control de turnos, puntaje y condicion de victoria.
// El store del cliente solo envuelve estas funciones, asi que todo es testeable aislado.

import { scoreOutcome } from './scoring';
import { boardPosition, isTransportSpace } from './board';
import {
  CARD_CATEGORIES,
  DEFAULT_TIMER_SECONDS,
  TIMER_OPTIONS,
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
export const MAX_PLAYERS = 6;

/** El marcador nunca baja de 0 (una "Visa Denegada" no deja a nadie en negativo). */
export const MIN_SCORE = 0;

/** Codigos estables de los errores de reglas (el cliente los traduce: errors.rules.<code>). */
export type GameRuleCode =
  | 'INVALID_TARGET'
  | 'INVALID_BOARD'
  | 'PLAYER_COUNT'
  | 'PLAYER_NAME_REQUIRED'
  | 'PLAYER_NAME_DUPLICATE'
  | 'PLAYER_COLOR_DUPLICATE'
  | 'INVALID_TIMER'
  | 'GAME_FINISHED'
  | 'TRANSPORT_EVENT_PENDING';

export class GameRuleError extends Error {
  constructor(
    message: string,
    public readonly code?: GameRuleCode,
    /** Valores para el texto traducido (p. ej. { min, max }). */
    public readonly params?: Record<string, string | number>,
  ) {
    super(message);
  }
}

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
    throw new GameRuleError(`Objetivo invalido para ${config.mode}: ${config.target}`, 'INVALID_TARGET');
  }
  if (config.board !== undefined && config.board !== 'PHYSICAL' && config.board !== 'DIGITAL') {
    throw new GameRuleError(`Modo de tablero invalido: ${String(config.board)}`, 'INVALID_BOARD');
  }
}

export function validatePlayers(players: readonly PlayerSetup[]): void {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new GameRuleError(`Se requieren entre ${MIN_PLAYERS} y ${MAX_PLAYERS} jugadores`, 'PLAYER_COUNT', {
      min: MIN_PLAYERS,
      max: MAX_PLAYERS,
    });
  }
  const names = players.map((p) => p.name.trim().toLowerCase());
  if (names.some((n) => n.length === 0)) throw new GameRuleError('Todos los jugadores necesitan nombre', 'PLAYER_NAME_REQUIRED');
  if (new Set(names).size !== names.length) throw new GameRuleError('Los nombres deben ser unicos', 'PLAYER_NAME_DUPLICATE');
  if (new Set(players.map((p) => p.color)).size !== players.length) {
    throw new GameRuleError('Cada peon debe tener un color distinto', 'PLAYER_COLOR_DUPLICATE');
  }
}

export function createGame(
  config: VictoryCondition,
  setups: readonly PlayerSetup[],
  opts: { id?: string; now?: Date; timerSeconds?: number } = {},
): GameState {
  validateConfig(config);
  validatePlayers(setups);
  const timerSeconds = opts.timerSeconds ?? DEFAULT_TIMER_SECONDS;
  validateTimer(timerSeconds);
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
    timerSeconds,
  };
}

export function validateTimer(seconds: number): void {
  if (!(TIMER_OPTIONS as readonly number[]).includes(seconds)) {
    throw new GameRuleError(`Tiempo por carta invalido: ${seconds}. Opciones: ${TIMER_OPTIONS.join(', ')}`, 'INVALID_TIMER');
  }
}

/** Partidas creadas antes de existir el timer usan el valor por defecto. */
export const timerSecondsOf = (state: GameState): number => state.timerSeconds ?? DEFAULT_TIMER_SECONDS;

export const currentPlayer = (state: GameState): GamePlayer => state.players[state.currentPlayerIndex]!;

/**
 * Resuelve la carta del jugador en turno y avanza al siguiente.
 * - POINTS: la partida termina en cuanto alguien alcanza el objetivo.
 * - ROUNDS: termina cuando el ultimo jugador completa la ronda objetivo.
 * - Casilla de transporte: si el jugador llega a una tras acertar una carta (no un evento), el turno no
 *   pasa: queda `transportEvent` y debe jugar un Evento de Viajero. Lo que mueva ese evento no encadena.
 */
export function applyTurn(
  state: GameState,
  outcome: CardOutcome,
  now: Date = new Date(),
): { state: GameState; result: ScoreResult } {
  if (state.status === 'FINISHED') throw new GameRuleError('La partida ya termino', 'GAME_FINISHED');
  if (state.transportEvent && outcome.kind !== 'EVENT') {
    throw new GameRuleError('Primero se juega el Evento de Viajero de la casilla de transporte', 'TRANSPORT_EVENT_PENDING');
  }

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

  const { transportEvent: _played, ...base } = state;
  const next: GameState = {
    ...base,
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
        ...(result.timedOut && { timedOut: true }),
        at: now.toISOString(),
      },
    ],
    usedCardIds: [...state.usedCardIds, outcome.card.id],
  };

  const landedOnTransport =
    (outcome.kind === 'QUIZ' || outcome.kind === 'LOCATION') &&
    result.delta > 0 &&
    isTransportSpace(boardPosition(newScore).space);
  if (landedOnTransport && !reachedGoal(next)) {
    return { state: { ...next, transportEvent: true }, result };
  }

  return { state: advance(next, now), result };
}

/**
 * Sin Eventos de Viajero en el mazo no se puede jugar el de la casilla de transporte:
 * la ficha queda ahi y pasa el turno.
 */
export function skipTransportEvent(state: GameState, now: Date = new Date()): GameState {
  if (!state.transportEvent) return state;
  const { transportEvent: _skipped, ...rest } = state;
  return advance(rest, now);
}

const reachedGoal = (state: GameState) =>
  state.config.mode === 'POINTS' && state.players.some((p) => p.score >= state.config.target);

/** El jugador juega su turno (los PAUSED y ABANDONED de las partidas online se saltan). */
export const isPlayerActive = (p: GamePlayer) => (p.presence ?? 'ACTIVE') === 'ACTIVE';

function advance(state: GameState, now: Date): GameState {
  const { mode, target } = state.config;
  if (reachedGoal(state)) {
    return finish(state, now);
  }

  // Pasa al siguiente jugador activo. Cada vez que se da la vuelta empieza una ronda nueva; en modo
  // rondas, dar la vuelta despues de la ultima termina la partida. Si nadie esta activo, queda en el
  // siguiente (la partida online espera a que alguien se reactive).
  let index = state.currentPlayerIndex;
  let round = state.round;
  for (let step = 0; step < state.players.length; step++) {
    const wraps = index === state.players.length - 1;
    if (wraps && mode === 'ROUNDS' && round >= target) {
      return finish({ ...state, currentPlayerIndex: index, round }, now);
    }
    index = wraps ? 0 : index + 1;
    if (wraps) round += 1;
    if (isPlayerActive(state.players[index]!)) break;
  }
  return { ...state, currentPlayerIndex: index, round };
}

/** Pasa el turno sin jugar carta (pase o tiempo agotado en el modo online). */
export function advanceTurn(state: GameState, now: Date = new Date()): GameState {
  if (state.status === 'FINISHED') return state;
  const { transportEvent: _pending, ...rest } = state;
  return advance(rest, now);
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
