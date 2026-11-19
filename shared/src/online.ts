// Partidas online multijugador (docs/specs/online-multiplayer.md). Funciones PURAS: reciben el estado,
// el mazo, el reloj y el azar, y devuelven un estado nuevo. El servidor las orquesta (sockets, BD,
// timers) y es el unico que conoce las cartas pendientes: los clientes reciben `toPublicView`.

import { rollDie } from './board';
import { drawCard, remainingByCategory, shuffle, type Rng } from './deck';
import {
  GameRuleError,
  MAX_PLAYERS,
  MIN_PLAYERS,
  advanceTurn,
  applyTurn,
  currentPlayer,
  finish,
  isPlayerActive,
  rankPlayers,
  skipTransportEvent,
  timerSecondsOf,
  validateConfig,
  validateTimer,
} from './engine';
import { MILES_PER_SPACE } from './scoring';
import type {
  Card,
  CardCategory,
  CardOutcome,
  GamePlayer,
  GameState,
  LatLng,
  LocationCard,
  PlayerPresence,
  PlayerSetup,
  QuizCard,
  ScoreResult,
  TravelEventCard,
  VictoryCondition,
} from './types';

/** Opciones del tiempo para tirar el dado (se elige al crear la sala). */
export const DIE_TIMEOUT_OPTIONS = [30, 60, 90, 120] as const;
export const DEFAULT_DIE_TIMEOUT_SECONDS = 60;
/** Pausa fija entre el dado y la carta (giro del dado + carta que salio), y mostrando el resultado (RN-15). */
export const REVEAL_MS = 4500;
export const RESULT_MS = 4000;
/** Margen por latencia para responder (RN-09). */
export const ANSWER_GRACE_MS = 2000;
/** Turnos perdidos seguidos que ponen al jugador en pausa (RN-11). */
export const MAX_MISSED_TURNS = 3;

export type OnlinePhase = 'LOBBY' | 'AWAITING_ROLL' | 'REVEALING' | 'AWAITING_ANSWER' | 'SHOWING_RESULT' | 'IDLE' | 'FINISHED';
export type OnlineEndReason = 'GOAL' | 'ROUNDS' | 'HOST_ENDED' | 'LAST_STANDING' | 'DECK_EMPTY';

/** Lo que paso en el ultimo turno; se muestra a todos (incluye la respuesta correcta). */
export interface OnlineResolution {
  playerId: string;
  /** Turno salteado sin carta: por tiempo para tirar o pase manual. */
  skipped?: 'TIMEOUT_ROLL' | 'PASS';
  dieFace?: number;
  card?: Card;
  result?: ScoreResult;
  answer?: string;
  guess?: LatLng;
  /** Evento de Viajero de la casilla de transporte, si lo hubo. */
  transport?: { card: TravelEventCard; result: ScoreResult } | { skipped: true };
  at: string;
}

export interface OnlineMeta {
  /** userId de cada peon (mismo orden que players). */
  userIds: string[];
  /** playerId del anfitrion actual. */
  hostPlayerId: string;
  /** playerIds en orden de invitacion (el creador primero): define a quien pasa el anfitrion. */
  invitationOrder: string[];
  dieTimeoutSeconds: number;
  phase: OnlinePhase;
  /** Hora limite (ISO) de la fase actual. */
  deadline?: string;
  /** Partida pausada por el anfitrion: lo que le quedaba a la fase. */
  pausedByHost?: { remainingMs: number | null; at: string };
  /** Carta robada y sin responder. SECRETA: nunca sale del servidor tal cual. */
  pending?: { cardId: string; dieFace: number; options?: string[] };
  lastResolution?: OnlineResolution;
  /** Turnos perdidos seguidos por playerId (RN-11). */
  missedTurns: Record<string, number>;
  /** Millas iniciales de quien se sumo tarde (no cuentan como aciertos). */
  initialMiles: Record<string, number>;
  endReason?: OnlineEndReason;
  /** Contador de cambios (lo usan los clientes para ordenar eventos). */
  seq: number;
}

export type OnlineGameState = GameState & { online: OnlineMeta };

export type OnlineAnswer = { answer: string } | { guess: LatLng };

const err = (message: string, code: string) => new GameRuleError(message, code as never);
const iso = (d: Date) => d.toISOString();
const at = (now: Date, ms: number) => iso(new Date(now.getTime() + ms));
const presenceOf = (p: GamePlayer): PlayerPresence => p.presence ?? 'ACTIVE';
const touch = (s: OnlineGameState, online: Partial<OnlineMeta>): OnlineGameState => ({
  ...s,
  online: { ...s.online, ...online, seq: s.online.seq + 1 },
});

export const isOnlineGame = (s: GameState): s is OnlineGameState => 'online' in s && !!(s as OnlineGameState).online;
export const playerIdOfUser = (s: OnlineGameState, userId: string) => {
  const i = s.online.userIds.indexOf(userId);
  return i === -1 ? null : s.players[i]!.id;
};
export const userIdOfPlayer = (s: OnlineGameState, playerId: string) => {
  const i = s.players.findIndex((p) => p.id === playerId);
  return i === -1 ? null : s.online.userIds[i]!;
};
/** Jugadores que no abandonaron (ACTIVE o PAUSED): el cupo de 6 se cuenta sobre ellos (RN-03). */
export const seatedPlayers = (s: GameState) => s.players.filter((p) => presenceOf(p) !== 'ABANDONED');

function requirePlayer(s: OnlineGameState, userId: string): GamePlayer {
  const id = playerIdOfUser(s, userId);
  if (!id) throw err('No participas en esta partida', 'NOT_IN_GAME');
  return s.players.find((p) => p.id === id)!;
}
function requireTurn(s: OnlineGameState, userId: string, phase: OnlinePhase) {
  if (s.status === 'FINISHED') throw err('La partida ya termino', 'GAME_FINISHED');
  if (s.online.pausedByHost) throw err('La partida esta en pausa', 'GAME_PAUSED');
  if (s.online.phase !== phase) throw err('No es el momento de esa accion', 'WRONG_PHASE');
  if (s.online.userIds[s.currentPlayerIndex] !== userId) throw err('No es tu turno', 'NOT_YOUR_TURN');
}
function requireHost(s: OnlineGameState, userId: string) {
  if (playerIdOfUser(s, userId) !== s.online.hostPlayerId) throw err('Solo el anfitrion puede hacerlo', 'NOT_HOST');
  if (s.status === 'FINISHED') throw err('La partida ya termino', 'GAME_FINISHED');
}

const emptyStats = (): GamePlayer['stats'] => ({
  cardsPlayed: 0,
  correct: 0,
  wrong: 0,
  pointsByCategory: { LOCATION: 0, FLAG: 0, CITY: 0, HISTORY: 0, PERSONALITY: 0, TRAVEL_EVENT: 0 },
  bestDistanceKm: null,
});

function validateSeat(s: OnlineGameState, setup: PlayerSetup, userId: string) {
  if (s.online.userIds.includes(userId)) throw err('Ya estas en esta partida', 'ALREADY_IN_GAME');
  if (seatedPlayers(s).length >= MAX_PLAYERS) throw err(`La partida ya tiene ${MAX_PLAYERS} jugadores`, 'GAME_FULL');
  if (s.players.some((p) => p.color === setup.color)) throw err('Ese color ya esta en uso', 'COLOR_TAKEN');
  const name = setup.name.trim();
  if (!name) throw err('Todos los jugadores necesitan nombre', 'PLAYER_NAME_REQUIRED');
  if (s.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw err('Ese nombre ya esta en uso', 'PLAYER_NAME_DUPLICATE');
}

/** Millas iniciales validas para quien se suma tarde: multiplo de 500, hasta el lider, debajo de la meta. */
export function maxInitialMiles(s: GameState): number {
  const leader = Math.max(0, ...s.players.map((p) => p.score));
  const cap = s.config.mode === 'POINTS' ? s.config.target - MILES_PER_SPACE : leader;
  return Math.max(0, Math.floor(Math.min(leader, cap) / MILES_PER_SPACE) * MILES_PER_SPACE);
}

// ── Sala ────────────────────────────────────────────────────────────────────

export function createOnlineGame(opts: {
  id: string;
  config: Omit<VictoryCondition, 'board'>;
  timerSeconds: number;
  dieTimeoutSeconds: number;
  host: { userId: string; setup: PlayerSetup };
  now?: Date;
}): OnlineGameState {
  const now = opts.now ?? new Date();
  const config: VictoryCondition = { ...opts.config, board: 'DIGITAL' };
  validateConfig(config);
  validateTimer(opts.timerSeconds);
  if (!(DIE_TIMEOUT_OPTIONS as readonly number[]).includes(opts.dieTimeoutSeconds)) {
    throw err('Tiempo para tirar el dado invalido', 'INVALID_TIMER');
  }
  const host: GamePlayer = { ...opts.host.setup, name: opts.host.setup.name.trim(), id: 'p1', score: 0, stats: emptyStats(), presence: 'ACTIVE' };
  return {
    id: opts.id,
    createdAt: iso(now),
    config,
    players: [host],
    currentPlayerIndex: 0,
    round: 1,
    status: 'PLAYING',
    history: [],
    usedCardIds: [],
    timerSeconds: opts.timerSeconds,
    online: {
      userIds: [opts.host.userId],
      hostPlayerId: host.id,
      invitationOrder: [host.id],
      dieTimeoutSeconds: opts.dieTimeoutSeconds,
      phase: 'LOBBY',
      missedTurns: {},
      initialMiles: {},
      seq: 0,
    },
  };
}

/** Suma un jugador: en la sala (millas 0) o con la partida en curso (al final del orden, 5.6). */
export function addPlayer(s: OnlineGameState, userId: string, setup: PlayerSetup, initialMiles = 0): OnlineGameState {
  if (s.status === 'FINISHED') throw err('La partida ya termino', 'GAME_FINISHED');
  validateSeat(s, setup, userId);
  const inLobby = s.online.phase === 'LOBBY';
  const miles = inLobby ? 0 : initialMiles;
  if (miles < 0 || miles % MILES_PER_SPACE !== 0 || miles > maxInitialMiles(s)) {
    throw err('Millas iniciales invalidas', 'INVALID_INITIAL_MILES');
  }
  const id = `p${s.players.length + 1}`;
  const player: GamePlayer = { ...setup, name: setup.name.trim(), id, score: miles, stats: emptyStats(), presence: 'ACTIVE' };
  let next = touch(
    { ...s, players: [...s.players, player] },
    {
      userIds: [...s.online.userIds, userId],
      invitationOrder: [...s.online.invitationOrder, id],
      initialMiles: miles > 0 ? { ...s.online.initialMiles, [id]: miles } : s.online.initialMiles,
    },
  );
  // Si la partida esperaba sin nadie activo, arranca con el que llego.
  if (next.online.phase === 'IDLE') next = startTurn(next, new Date());
  return next;
}

/** Sale de la sala antes de empezar (el anfitrion no: cancela la sala). */
export function leaveLobby(s: OnlineGameState, userId: string): OnlineGameState {
  if (s.online.phase !== 'LOBBY') throw err('La partida ya empezo', 'WRONG_PHASE');
  const pid = playerIdOfUser(s, userId);
  if (!pid) throw err('No participas en esta partida', 'NOT_IN_GAME');
  if (pid === s.online.hostPlayerId) throw err('El anfitrion cancela la sala', 'NOT_HOST');
  const i = s.players.findIndex((p) => p.id === pid);
  return touch(
    { ...s, players: s.players.filter((p) => p.id !== pid) },
    { userIds: s.online.userIds.filter((_, j) => j !== i), invitationOrder: s.online.invitationOrder.filter((id) => id !== pid) },
  );
}

export function startOnlineGame(s: OnlineGameState, userId: string, now: Date = new Date()): OnlineGameState {
  requireHost(s, userId);
  if (s.online.phase !== 'LOBBY') throw err('La partida ya empezo', 'WRONG_PHASE');
  if (s.players.length < MIN_PLAYERS) throw err(`Se necesitan al menos ${MIN_PLAYERS} jugadores`, 'PLAYER_COUNT');
  return startTurn({ ...s, currentPlayerIndex: 0, round: 1, createdAt: iso(now) }, now);
}

// ── Turnos ──────────────────────────────────────────────────────────────────

/** Arranca el turno del jugador actual (o del siguiente activo). Sin nadie activo: IDLE. */
function startTurn(s: OnlineGameState, now: Date): OnlineGameState {
  if (s.status === 'FINISHED') return s;
  let next: GameState = s;
  if (!isPlayerActive(currentPlayer(next))) next = advanceTurn(next, now);
  const state = { ...(next as OnlineGameState), online: s.online };
  if (state.status === 'FINISHED') return finalize(state, state.config.mode === 'ROUNDS' ? 'ROUNDS' : 'GOAL', now);
  if (!isPlayerActive(currentPlayer(state))) return touch(state, { phase: 'IDLE', deadline: undefined, pending: undefined });
  return touch(state, { phase: 'AWAITING_ROLL', deadline: at(now, s.online.dieTimeoutSeconds * 1000), pending: undefined });
}

/** Tira el dado del servidor (RN-07) y roba la carta. Fase REVEALING. */
export function roll(s: OnlineGameState, deck: readonly Card[], userId: string, rng: Rng = Math.random, now: Date = new Date()): OnlineGameState {
  requireTurn(s, userId, 'AWAITING_ROLL');
  return doRoll(s, deck, rng, now);
}

function doRoll(s: OnlineGameState, deck: readonly Card[], rng: Rng, now: Date): OnlineGameState {
  const remaining = remainingByCategory(deck, s.usedCardIds);
  const rolled = rollDie((c: CardCategory) => remaining[c] > 0, rng);
  if (!rolled) return finalize(finish(s, now) as OnlineGameState, 'DECK_EMPTY', now);
  const card = drawCard<Card>(deck, rolled.category, s.usedCardIds, rng)!;
  const options = 'options' in card ? shuffle(card.options, rng) : undefined;
  const pid = currentPlayer(s).id;
  return touch(s, {
    phase: 'REVEALING',
    deadline: at(now, REVEAL_MS),
    pending: { cardId: card.id, dieFace: rolled.face, ...(options && { options }) },
    missedTurns: { ...s.online.missedTurns, [pid]: 0 },
  });
}

const cardById = (deck: readonly Card[], id: string) => {
  const card = deck.find((c) => c.id === id);
  if (!card) throw err('Carta desconocida', 'CARD_NOT_FOUND');
  return card;
};

/** Fin de la pausa de revelado: se abre la carta (los eventos se aplican solos, D8). */
export function revealCard(s: OnlineGameState, deck: readonly Card[], rng: Rng = Math.random, now: Date = new Date()): OnlineGameState {
  if (s.online.phase !== 'REVEALING' || !s.online.pending) throw err('No hay carta para revelar', 'WRONG_PHASE');
  const card = cardById(deck, s.online.pending.cardId);
  if (card.category === 'TRAVEL_EVENT') return resolveCard(s, deck, { kind: 'EVENT', card }, rng, now);
  return touch(s, { phase: 'AWAITING_ANSWER', deadline: at(now, timerSecondsOf(s) * 1000 + ANSWER_GRACE_MS) });
}

/** Respuesta del jugador activo (opcion o punto en el mapa). Rechaza respuestas tardias. */
export function submitAnswer(
  s: OnlineGameState,
  deck: readonly Card[],
  userId: string,
  answer: OnlineAnswer,
  rng: Rng = Math.random,
  now: Date = new Date(),
): OnlineGameState {
  requireTurn(s, userId, 'AWAITING_ANSWER');
  if (s.online.deadline && now.getTime() > new Date(s.online.deadline).getTime()) throw err('Se acabo el tiempo', 'TOO_LATE');
  const card = cardById(deck, s.online.pending!.cardId);
  let outcome: CardOutcome;
  if (card.category === 'LOCATION') {
    if (!('guess' in answer)) throw err('Falta el punto en el mapa', 'INVALID_ANSWER');
    outcome = { kind: 'LOCATION', card: card as LocationCard, guess: answer.guess };
  } else if (card.category === 'TRAVEL_EVENT') {
    throw err('Los eventos no se responden', 'INVALID_ANSWER');
  } else {
    if (!('answer' in answer) || !s.online.pending!.options?.includes(answer.answer)) throw err('Respuesta invalida', 'INVALID_ANSWER');
    outcome = { kind: 'QUIZ', card: card as QuizCard, answer: answer.answer };
  }
  const missed = { ...s.online.missedTurns, [currentPlayer(s).id]: 0 };
  return resolveCard({ ...s, online: { ...s.online, missedTurns: missed } }, deck, outcome, rng, now);
}

/** Aplica la carta con el motor de siempre y, si cae en un transporte, juega el evento en el mismo turno. */
function resolveCard(s: OnlineGameState, deck: readonly Card[], outcome: CardOutcome, rng: Rng, now: Date): OnlineGameState {
  const player = currentPlayer(s);
  const pending = s.online.pending!;
  let { state, result } = applyTurn(s, outcome, now);
  let transport: OnlineResolution['transport'];
  if (state.transportEvent) {
    const event = drawCard<TravelEventCard>(deck, 'TRAVEL_EVENT', state.usedCardIds, rng);
    if (event) {
      const applied = applyTurn(state, { kind: 'EVENT', card: event }, now);
      state = applied.state;
      transport = { card: event, result: applied.result };
    } else {
      state = skipTransportEvent(state, now);
      transport = { skipped: true };
    }
  }
  const resolution: OnlineResolution = {
    playerId: player.id,
    dieFace: pending.dieFace,
    card: outcome.card,
    result,
    ...(outcome.kind === 'QUIZ' && { answer: outcome.answer }),
    ...(outcome.kind === 'LOCATION' && { guess: outcome.guess }),
    ...(transport && { transport }),
    at: iso(now),
  };
  const next = { ...(state as OnlineGameState), online: s.online };
  if (next.status === 'FINISHED') {
    return finalize(touch(next, { lastResolution: resolution, pending: undefined }), next.config.mode === 'ROUNDS' ? 'ROUNDS' : 'GOAL', now);
  }
  return touch(next, { phase: 'SHOWING_RESULT', deadline: at(now, RESULT_MS), pending: undefined, lastResolution: resolution });
}

/** "Pasar turno": solo antes de tirar, 0 millas, no cuenta como turno perdido (RN-10, RN-11). */
export function passTurn(s: OnlineGameState, userId: string, now: Date = new Date()): OnlineGameState {
  requireTurn(s, userId, 'AWAITING_ROLL');
  return skipTurn(s, 'PASS', now);
}

function skipTurn(s: OnlineGameState, reason: 'PASS' | 'TIMEOUT_ROLL', now: Date): OnlineGameState {
  const resolution: OnlineResolution = { playerId: currentPlayer(s).id, skipped: reason, at: iso(now) };
  const advanced = { ...(advanceTurn(s, now) as OnlineGameState), online: s.online };
  if (advanced.status === 'FINISHED') return finalize(touch(advanced, { lastResolution: resolution }), 'ROUNDS', now);
  return startTurn(touch(advanced, { lastResolution: resolution }), now);
}

/** Fin de la pausa de resultado: arranca el turno siguiente. */
export function nextTurn(s: OnlineGameState, now: Date = new Date()): OnlineGameState {
  if (s.online.phase !== 'SHOWING_RESULT') throw err('No hay resultado en pantalla', 'WRONG_PHASE');
  return startTurn(s, now);
}

/** Vence el deadline de la fase actual (lo llama el timer del servidor). */
export function expireDeadline(s: OnlineGameState, deck: readonly Card[], rng: Rng = Math.random, now: Date = new Date()): OnlineGameState {
  if (s.status === 'FINISHED' || s.online.pausedByHost || !s.online.deadline) return s;
  if (now.getTime() < new Date(s.online.deadline).getTime()) return s;
  const pid = currentPlayer(s).id;
  const missedAfter = (s.online.missedTurns[pid] ?? 0) + 1;
  switch (s.online.phase) {
    case 'AWAITING_ROLL': {
      const withMiss = { ...s, online: { ...s.online, missedTurns: { ...s.online.missedTurns, [pid]: missedAfter } } };
      const paused = missedAfter >= MAX_MISSED_TURNS ? setPresenceOf(withMiss, pid, 'PAUSED') : withMiss;
      return skipTurn(paused, 'TIMEOUT_ROLL', now);
    }
    case 'REVEALING':
      return revealCard(s, deck, rng, now);
    case 'AWAITING_ANSWER': {
      const card = cardById(deck, s.online.pending!.cardId) as LocationCard | QuizCard;
      const resolved = resolveCard(s, deck, { kind: 'TIMEOUT', card }, rng, now);
      const withMiss = { ...resolved, online: { ...resolved.online, missedTurns: { ...resolved.online.missedTurns, [pid]: missedAfter } } };
      return missedAfter >= MAX_MISSED_TURNS && withMiss.status !== 'FINISHED' ? setPresenceOf(withMiss, pid, 'PAUSED') : withMiss;
    }
    case 'SHOWING_RESULT':
      return startTurn(s, now);
    default:
      return s;
  }
}

// ── Pausa, abandono y anfitrion ─────────────────────────────────────────────

const setPresenceOf = (s: OnlineGameState, playerId: string, presence: PlayerPresence): OnlineGameState => ({
  ...s,
  players: s.players.map((p) => (p.id === playerId ? { ...p, presence } : p)),
});

/** Si es el turno de quien se va, su carta abierta cuenta como error y el turno pasa. */
function leaveTurn(s: OnlineGameState, deck: readonly Card[], playerId: string, rng: Rng, now: Date): OnlineGameState {
  if (s.status === 'FINISHED' || currentPlayer(s).id !== playerId) return s;
  switch (s.online.phase) {
    case 'AWAITING_ROLL':
      return skipTurn(s, 'PASS', now);
    case 'REVEALING':
    case 'AWAITING_ANSWER': {
      const card = cardById(deck, s.online.pending!.cardId);
      const outcome: CardOutcome =
        card.category === 'TRAVEL_EVENT' ? { kind: 'EVENT', card } : { kind: 'TIMEOUT', card: card as LocationCard | QuizCard };
      return resolveCard(s, deck, outcome, rng, now);
    }
    default:
      return s;
  }
}

/** El anfitrion pasa al siguiente ACTIVE en orden de invitacion; si no hay, al primer PAUSED (RN-17). */
function transferHost(s: OnlineGameState): OnlineGameState {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const order = s.online.invitationOrder.map((id) => byId.get(id)!).filter(Boolean);
  const next = order.find((p) => presenceOf(p) === 'ACTIVE') ?? order.find((p) => presenceOf(p) === 'PAUSED');
  return next ? touch(s, { hostPlayerId: next.id }) : s;
}

/** Pausarse, reactivarse, abandonar o volver (RN-03, RN-13, RN-17, RN-18). */
export function setPresence(
  s: OnlineGameState,
  deck: readonly Card[],
  userId: string,
  presence: PlayerPresence,
  rng: Rng = Math.random,
  now: Date = new Date(),
): OnlineGameState {
  if (s.status === 'FINISHED') throw err('La partida ya termino', 'GAME_FINISHED');
  if (s.online.phase === 'LOBBY') throw err('La partida todavia no empezo', 'WRONG_PHASE');
  const player = requirePlayer(s, userId);
  const current = presenceOf(player);
  if (current === presence) return s;

  if (presence === 'ACTIVE') {
    // Reactivarse (desde PAUSED) o volver (desde ABANDONED, con sus millas) si hay lugar.
    if (current === 'ABANDONED' && seatedPlayers(s).length >= MAX_PLAYERS) throw err('La partida esta completa', 'GAME_FULL');
    let next = touch(setPresenceOf(s, player.id, 'ACTIVE'), { missedTurns: { ...s.online.missedTurns, [player.id]: 0 } });
    if (next.online.phase === 'IDLE' && !next.online.pausedByHost) next = startTurn(next, now);
    return next;
  }

  let next = leaveTurn(s, deck, player.id, rng, now);
  next = touch(setPresenceOf(next, player.id, presence), {});
  if (presence === 'ABANDONED') {
    if (next.online.hostPlayerId === player.id) next = transferHost(next);
    const seated = seatedPlayers(next);
    if (seated.length === 1 && next.status !== 'FINISHED') return lastStanding(next, seated[0]!.id, now);
  }
  // Si era su turno y nadie mas esta activo, la partida queda esperando.
  if (next.status !== 'FINISHED' && ['AWAITING_ROLL', 'IDLE'].includes(next.online.phase)) {
    if (!isPlayerActive(currentPlayer(next))) next = startTurn(next, now);
  }
  return next;
}

/** Queda uno solo sin abandonar: gana el, tenga las millas que tenga (RN-18). */
function lastStanding(s: OnlineGameState, winnerId: string, now: Date): OnlineGameState {
  const finished = { ...(finish(s, now) as OnlineGameState), winnerIds: [winnerId] };
  return finalize(finished, 'LAST_STANDING', now);
}

/** Cierra la partida: los PAUSED pasan a ABANDONED y se guarda el motivo. */
function finalize(s: OnlineGameState, reason: OnlineEndReason, now: Date): OnlineGameState {
  const done = s.status === 'FINISHED' ? s : (finish(s, now) as OnlineGameState);
  return touch(
    { ...done, players: done.players.map((p) => (presenceOf(p) === 'PAUSED' ? { ...p, presence: 'ABANDONED' as const } : p)) },
    { phase: 'FINISHED', deadline: undefined, pending: undefined, pausedByHost: undefined, endReason: s.online.endReason ?? reason },
  );
}

export function hostPause(s: OnlineGameState, userId: string, now: Date = new Date()): OnlineGameState {
  requireHost(s, userId);
  if (s.online.phase === 'LOBBY') throw err('La partida todavia no empezo', 'WRONG_PHASE');
  if (s.online.pausedByHost) return s;
  const remainingMs = s.online.deadline ? Math.max(0, new Date(s.online.deadline).getTime() - now.getTime()) : null;
  return touch(s, { pausedByHost: { remainingMs, at: iso(now) }, deadline: undefined });
}

export function hostResume(s: OnlineGameState, userId: string, now: Date = new Date()): OnlineGameState {
  requireHost(s, userId);
  const paused = s.online.pausedByHost;
  if (!paused) return s;
  let next = touch(s, { pausedByHost: undefined, deadline: paused.remainingMs === null ? undefined : at(now, paused.remainingMs) });
  if (next.online.phase === 'IDLE') next = startTurn(next, now);
  return next;
}

/** "Terminar": gana el que tiene mas millas, incluidos los que abandonaron (RN-16). */
export function hostEnd(s: OnlineGameState, userId: string, now: Date = new Date()): OnlineGameState {
  requireHost(s, userId);
  if (s.online.phase === 'LOBBY') throw err('La partida todavia no empezo', 'WRONG_PHASE');
  return finalize(s, 'HOST_ENDED', now);
}

// ── Vista publica ───────────────────────────────────────────────────────────

/** Carta sin los datos que revelan la respuesta (tabla 7.3). */
export type PublicCard =
  | (Omit<QuizCard, 'correctAnswer' | 'funFact' | 'translations'> & { correctAnswer?: undefined })
  | (Omit<LocationCard, 'location' | 'answerLabel' | 'translations'> & {
      /** Solo para el jugador activo en cartas de Street View (lo necesita el panorama). */
      location?: LatLng;
      /** Los espectadores de una carta Street View ven una foto fija (proxy del servidor). */
      spectatorPhoto?: boolean;
    })
  | Omit<TravelEventCard, 'translations'>;

export interface PublicGameView {
  state: Omit<OnlineGameState, 'online'> & { online: Omit<OnlineMeta, 'pending'> };
  pending?: { card: PublicCard; dieFace: number; options?: string[] };
  you: { playerId: string | null; isActive: boolean; isHost: boolean };
}

function publicCard(card: Card, viewerIsActive: boolean): PublicCard {
  if (card.category === 'TRAVEL_EVENT') {
    const { translations: _t, ...rest } = card;
    return rest;
  }
  if (card.category === 'LOCATION') {
    const { location, answerLabel: _a, translations: _t, ...rest } = card;
    const streetView = !card.imageUrl;
    if (!streetView) return rest;
    return viewerIsActive ? { ...rest, location } : { ...rest, spectatorPhoto: true };
  }
  const { correctAnswer: _c, funFact: _f, translations: _t, ...rest } = card;
  return rest;
}

/** Lo que recibe cada usuario. Nunca incluye la respuesta de la carta pendiente. */
export function toPublicView(s: OnlineGameState, deck: readonly Card[], viewerUserId: string): PublicGameView {
  const playerId = playerIdOfUser(s, viewerUserId);
  const isActive = s.status === 'PLAYING' && s.online.phase !== 'LOBBY' && s.online.userIds[s.currentPlayerIndex] === viewerUserId;
  const { pending, ...online } = s.online;
  const view: PublicGameView = {
    state: { ...s, online },
    you: { playerId, isActive, isHost: playerId === s.online.hostPlayerId },
  };
  // El dado se ve apenas se tira; la carta, cuando termina la pausa de revelado.
  if (pending) {
    const card = cardById(deck, pending.cardId);
    view.pending = {
      dieFace: pending.dieFace,
      card: s.online.phase === 'REVEALING' ? ({ id: card.id, category: card.category } as PublicCard) : publicCard(card, isActive),
      ...(pending.options && s.online.phase !== 'REVEALING' && { options: pending.options }),
    };
  }
  return view;
}

/** Ranking final con la marca de quien abandono (para la pantalla de victoria). */
export const onlineRanking = (s: OnlineGameState) =>
  rankPlayers(s.players).map((r) => ({ ...r, abandoned: presenceOf(r.player) === 'ABANDONED' }));
