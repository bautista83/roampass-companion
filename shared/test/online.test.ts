import { describe, expect, it } from 'vitest';
import {
  ANSWER_GRACE_MS,
  BOARD,
  GameRuleError,
  MAX_MISSED_TURNS,
  REVEAL_MS,
  RESULT_MS,
  addPlayer,
  createOnlineGame,
  expireDeadline,
  hostEnd,
  hostPause,
  hostResume,
  leaveLobby,
  maxInitialMiles,
  nextTurn,
  passTurn,
  revealCard,
  roll,
  seededRng,
  setPresence,
  startOnlineGame,
  submitAnswer,
  toPublicView,
  type Card,
  type LocationCard,
  type OnlineGameState,
  type PawnColor,
  type QuizCard,
  type TravelEventCard,
} from '../src';

// ── Mazos chicos para controlar el dado (solo hay cartas de una categoria) ──
const quiz = (n: number): QuizCard => ({
  id: `h${n}`,
  category: 'HISTORY',
  difficulty: 'EASY',
  prompt: `Pregunta ${n}`,
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'B',
  funFact: 'Dato',
});
const event = (n: number, points: number): TravelEventCard => ({
  id: `e${n}`,
  category: 'TRAVEL_EVENT',
  title: `Evento ${n}`,
  description: 'desc',
  points,
  icon: '🛂',
});
const streetView: LocationCard = { id: 'sv1', category: 'LOCATION', difficulty: 'EASY', prompt: '¿Dónde?', location: { lat: 10, lng: 20 }, answerLabel: 'Secreto' };
const HISTORY: Card[] = Array.from({ length: 30 }, (_, i) => quiz(i));
const EVENTS: Card[] = Array.from({ length: 10 }, (_, i) => event(i, 500));

const T0 = new Date('2026-11-20T12:00:00Z');
const later = (ms: number, from = T0) => new Date(from.getTime() + ms);
const rng = seededRng('test');
const COLORS: PawnColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const setup = (i: number) => ({ name: `Jugador${i + 1}`, color: COLORS[i]!, avatar: '🧭' });
const user = (i: number) => `u${i + 1}`;

/** Sala con n jugadores (u1 es el anfitrion), ya empezada. */
function started(n: number, opts: { mode?: 'POINTS' | 'ROUNDS'; target?: number } = {}): OnlineGameState {
  let s = createOnlineGame({
    id: 'g1',
    config: { mode: opts.mode ?? 'POINTS', target: opts.target ?? 25_000 },
    timerSeconds: 10,
    dieTimeoutSeconds: 60,
    host: { userId: user(0), setup: setup(0) },
    now: T0,
  });
  for (let i = 1; i < n; i++) s = addPlayer(s, user(i), setup(i));
  return startOnlineGame(s, user(0), T0);
}
const activeUser = (s: OnlineGameState) => s.online.userIds[s.currentPlayerIndex]!;
/** Tira, revela y responde la carta del jugador activo. */
function playQuiz(s: OnlineGameState, answer: string, deck: Card[] = HISTORY): OnlineGameState {
  let x = roll(s, deck, activeUser(s), rng, T0);
  x = revealCard(x, deck, rng, later(REVEAL_MS));
  return submitAnswer(x, deck, activeUser(x), { answer }, rng, later(REVEAL_MS + 1000));
}

describe('sala de espera', () => {
  it('no se puede empezar con un solo jugador; con 2, el anfitrion arranca primero', () => {
    const lobby = createOnlineGame({ id: 'g', config: { mode: 'POINTS', target: 25_000 }, timerSeconds: 10, dieTimeoutSeconds: 60, host: { userId: 'u1', setup: setup(0) }, now: T0 });
    expect(lobby.online.phase).toBe('LOBBY');
    expect(() => startOnlineGame(lobby, 'u1', T0)).toThrow(GameRuleError);
    const two = addPlayer(lobby, 'u2', setup(1));
    expect(() => startOnlineGame(two, 'u2', T0)).toThrow(/anfitrion/);
    const s = startOnlineGame(two, 'u1', T0);
    expect(s.online.phase).toBe('AWAITING_ROLL');
    expect(activeUser(s)).toBe('u1');
    expect(s.online.deadline).toBe(later(60_000).toISOString());
  });

  it('valida color, nombre, usuario repetido y el maximo de 6', () => {
    let s = createOnlineGame({ id: 'g', config: { mode: 'POINTS', target: 25_000 }, timerSeconds: 10, dieTimeoutSeconds: 60, host: { userId: 'u1', setup: setup(0) }, now: T0 });
    expect(() => addPlayer(s, 'u2', { ...setup(1), color: 'red' })).toThrow(/color/);
    expect(() => addPlayer(s, 'u2', { ...setup(1), name: 'jugador1' })).toThrow(/nombre/);
    expect(() => addPlayer(s, 'u1', setup(1))).toThrow(/Ya estas/);
    for (let i = 1; i < 6; i++) s = addPlayer(s, user(i), setup(i));
    expect(() => addPlayer(s, 'u7', { name: 'Siete', color: 'red', avatar: '🧭' })).toThrow();
  });

  it('un invitado puede salir de la sala; el anfitrion no', () => {
    let s = createOnlineGame({ id: 'g', config: { mode: 'POINTS', target: 25_000 }, timerSeconds: 10, dieTimeoutSeconds: 60, host: { userId: 'u1', setup: setup(0) }, now: T0 });
    s = addPlayer(s, 'u2', setup(1));
    expect(leaveLobby(s, 'u2').players).toHaveLength(1);
    expect(() => leaveLobby(s, 'u1')).toThrow();
  });
});

describe('turnos (CA-10 a CA-13)', () => {
  it('el dado lo tira el servidor: revela, se responde y todos ven el resultado', () => {
    let s = started(2);
    s = roll(s, HISTORY, 'u1', rng, T0);
    expect(s.online.phase).toBe('REVEALING');
    expect(s.online.pending?.dieFace).toBe(4); // HISTORY = cara 4
    expect(s.online.deadline).toBe(later(REVEAL_MS).toISOString());
    s = revealCard(s, HISTORY, rng, later(REVEAL_MS));
    expect(s.online.phase).toBe('AWAITING_ANSWER');
    expect(s.online.deadline).toBe(later(REVEAL_MS + 10_000 + ANSWER_GRACE_MS).toISOString());
    s = submitAnswer(s, HISTORY, 'u1', { answer: 'B' }, rng, later(REVEAL_MS + 2000));
    expect(s.online.phase).toBe('SHOWING_RESULT');
    expect(s.players[0]!.score).toBe(2500);
    expect(s.online.lastResolution).toMatchObject({ playerId: 'p1', answer: 'B', result: { delta: 2500, correct: true } });
    expect(activeUser(s)).toBe('u2');
    s = nextTurn(s, later(REVEAL_MS + 2000 + RESULT_MS));
    expect(s.online.phase).toBe('AWAITING_ROLL');
  });

  it('rechaza acciones de quien no tiene el turno (CA-11) y respuestas tardias', () => {
    const s = started(2);
    expect(() => roll(s, HISTORY, 'u2', rng, T0)).toThrow(/turno/);
    let x = roll(s, HISTORY, 'u1', rng, T0);
    x = revealCard(x, HISTORY, rng, later(REVEAL_MS));
    expect(() => submitAnswer(x, HISTORY, 'u2', { answer: 'B' }, rng, later(REVEAL_MS))).toThrow(/turno/);
    expect(() => submitAnswer(x, HISTORY, 'u1', { answer: 'Z' }, rng, later(REVEAL_MS))).toThrow(/invalida/);
    expect(() => submitAnswer(x, HISTORY, 'u1', { answer: 'B' }, rng, later(REVEAL_MS + 13_000))).toThrow(/tiempo/);
  });

  it('las opciones se mezclan en el servidor y no cambian', () => {
    let s = roll(started(2), HISTORY, 'u1', rng, T0);
    s = revealCard(s, HISTORY, rng, later(REVEAL_MS));
    const opts = s.online.pending!.options!;
    expect([...opts].sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(toPublicView(s, HISTORY, 'u2').pending?.options).toEqual(opts);
  });

  it('los eventos de viajero se aplican solos al revelarse', () => {
    let s = roll(started(2), EVENTS, 'u1', rng, T0);
    s = revealCard(s, EVENTS, rng, later(REVEAL_MS));
    expect(s.online.phase).toBe('SHOWING_RESULT');
    expect(s.players[0]!.score).toBe(500);
  });

  it('al caer en un transporte tras acertar, se juega un evento en el mismo turno (CA-19)', () => {
    const transport = BOARD.spaces.findIndex((sp, i) => i >= 5 && sp.type === 'transport');
    const base = started(2);
    // Ubica al jugador 5 casillas antes del transporte: acertar HISTORY (+2.500) lo deja ahi.
    const s0 = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, score: (transport - 5) * 500 } : p)) };
    const deck = [...HISTORY, ...EVENTS];
    let s = roll(s0, HISTORY, 'u1', rng, T0); // el dado solo saca HISTORY
    s = revealCard(s, deck, rng, later(REVEAL_MS));
    s = submitAnswer(s, deck, 'u1', { answer: 'B' }, rng, later(REVEAL_MS + 1000));
    expect(s.online.lastResolution?.transport).toMatchObject({ result: { delta: 500 } });
    expect(s.players[0]!.score).toBe(transport * 500 + 500);
    expect(activeUser(s)).toBe('u2');
  });
});

describe('vista publica (CA-12, CA-18)', () => {
  it('nunca manda la respuesta de la carta pendiente; la revela al resolverse', () => {
    let s = roll(started(2), HISTORY, 'u1', rng, T0);
    expect(toPublicView(s, HISTORY, 'u2').pending?.options).toBeUndefined(); // en revelado: solo el dado
    s = revealCard(s, HISTORY, rng, later(REVEAL_MS));
    for (const viewer of ['u1', 'u2']) {
      const json = JSON.stringify(toPublicView(s, HISTORY, viewer));
      expect(json).not.toContain('correctAnswer');
      expect(json).not.toContain('Dato');
    }
    s = submitAnswer(s, HISTORY, 'u1', { answer: 'A' }, rng, later(REVEAL_MS + 1000));
    expect(JSON.stringify(toPublicView(s, HISTORY, 'u2'))).toContain('"correctAnswer":"B"');
  });

  it('Street View: el activo recibe las coordenadas; los demas, una foto fija', () => {
    const deck: Card[] = [streetView];
    let s = roll(started(2), deck, 'u1', rng, T0);
    s = revealCard(s, deck, rng, later(REVEAL_MS));
    const mine = toPublicView(s, deck, 'u1').pending!.card;
    const theirs = toPublicView(s, deck, 'u2').pending!.card;
    expect(mine).toMatchObject({ location: { lat: 10, lng: 20 } });
    expect(theirs).toMatchObject({ spectatorPhoto: true });
    expect(JSON.stringify(theirs)).not.toContain('"lat"');
    expect(JSON.stringify(mine)).not.toContain('Secreto');
    expect(toPublicView(s, deck, 'u1').you).toEqual({ playerId: 'p1', isActive: true, isHost: true });
  });
});

describe('tiempos y turnos perdidos (CA-14 a CA-17)', () => {
  it('sin tirar el dado a tiempo, el turno pasa con 0 millas', () => {
    let s = started(2);
    s = expireDeadline(s, HISTORY, rng, later(59_000)); // todavia no
    expect(activeUser(s)).toBe('u1');
    s = expireDeadline(s, HISTORY, rng, later(60_000));
    expect(activeUser(s)).toBe('u2');
    expect(s.online.lastResolution).toMatchObject({ playerId: 'p1', skipped: 'TIMEOUT_ROLL' });
    expect(s.online.missedTurns.p1).toBe(1);
    expect(s.history).toHaveLength(0); // no cuenta como carta jugada (RN-12)
  });

  it('sin responder a tiempo, la carta cuenta como error', () => {
    let s = roll(started(2), HISTORY, 'u1', rng, T0);
    s = revealCard(s, HISTORY, rng, later(REVEAL_MS));
    s = expireDeadline(s, HISTORY, rng, later(REVEAL_MS + 12_000));
    expect(s.players[0]!.stats.wrong).toBe(1);
    expect(s.online.lastResolution?.result?.timedOut).toBe(true);
  });

  it(`al perder ${MAX_MISSED_TURNS} turnos seguidos el jugador pasa a pausa`, () => {
    let s = started(2);
    let now = T0;
    for (let i = 0; i < MAX_MISSED_TURNS; i++) {
      now = new Date(s.online.deadline!);
      s = expireDeadline(s, HISTORY, rng, now); // u1 pierde
      if (s.players[0]!.presence === 'PAUSED') break;
      s = passTurn(s, 'u2', now); // u2 pasa (no cuenta)
    }
    expect(s.players[0]!.presence).toBe('PAUSED');
    expect(s.online.missedTurns.p2 ?? 0).toBe(0);
    // Sus turnos se saltan: siempre le toca a u2.
    s = passTurn(s, 'u2', now);
    expect(activeUser(s)).toBe('u2');
  });

  it('jugar un turno pone el contador en 0', () => {
    let s = expireDeadline(started(2), HISTORY, rng, later(60_000)); // u1 pierde 1
    s = passTurn(s, 'u2', later(60_000));
    s = playQuiz(s, 'B');
    expect(s.online.missedTurns.p1).toBe(0);
  });
});

describe('pausa, abandono y anfitrion (CA-20 a CA-27)', () => {
  it('pausarse salta los turnos y solo el mismo jugador se reactiva', () => {
    let s = started(3);
    s = setPresence(s, HISTORY, 'u2', 'PAUSED', rng, T0);
    s = passTurn(s, 'u1', T0);
    expect(activeUser(s)).toBe('u3');
    expect(() => setPresence(s, HISTORY, 'u9', 'ACTIVE', rng, T0)).toThrow();
    s = setPresence(s, HISTORY, 'u2', 'ACTIVE', rng, T0);
    s = passTurn(s, 'u3', T0);
    s = passTurn(s, 'u1', T0);
    expect(activeUser(s)).toBe('u2');
  });

  it('pausarse con la carta abierta la cuenta como error y pasa el turno', () => {
    let s = roll(started(2), HISTORY, 'u1', rng, T0);
    s = revealCard(s, HISTORY, rng, later(REVEAL_MS));
    s = setPresence(s, HISTORY, 'u1', 'PAUSED', rng, later(REVEAL_MS + 1000));
    expect(s.players[0]!.stats.wrong).toBe(1);
    expect(activeUser(s)).toBe('u2');
  });

  it('la pausa del anfitrion congela el reloj y lo retoma con lo que quedaba (CA-21)', () => {
    let s = roll(started(2), HISTORY, 'u1', rng, T0);
    s = revealCard(s, HISTORY, rng, later(REVEAL_MS)); // vence en REVEAL+12s
    s = hostPause(s, 'u1', later(REVEAL_MS + 5000)); // quedan 7s
    expect(s.online.pausedByHost?.remainingMs).toBe(7000);
    expect(expireDeadline(s, HISTORY, rng, later(999_999))).toBe(s); // no corre nada
    expect(() => submitAnswer(s, HISTORY, 'u1', { answer: 'B' }, rng, later(REVEAL_MS + 6000))).toThrow(/pausa/);
    expect(() => hostPause(s, 'u2')).toThrow(/anfitrion/);
    const resumeAt = later(100_000);
    s = hostResume(s, 'u1', resumeAt);
    expect(s.online.deadline).toBe(later(7000, resumeAt).toISOString());
  });

  it('al abandonar el anfitrion, el rol pasa al siguiente activo en orden de invitacion (CA-23)', () => {
    let s = started(3);
    s = setPresence(s, HISTORY, 'u2', 'PAUSED', rng, T0);
    s = setPresence(s, HISTORY, 'u1', 'ABANDONED', rng, T0);
    expect(s.online.hostPlayerId).toBe('p3');
    expect(toPublicView(s, HISTORY, 'u3').you.isHost).toBe(true);
  });

  it('si quedan todos menos uno abandonados, gana el que queda aunque tenga menos millas (CA-24)', () => {
    let s = started(3);
    s = playQuiz(s, 'B'); // u1 suma 2.500
    s = nextTurn(s, later(10_000));
    s = setPresence(s, HISTORY, 'u1', 'ABANDONED', rng, later(10_000));
    s = setPresence(s, HISTORY, 'u3', 'ABANDONED', rng, later(10_000));
    expect(s.status).toBe('FINISHED');
    expect(s.online.endReason).toBe('LAST_STANDING');
    expect(s.winnerIds).toEqual(['p2']);
  });

  it('"Terminar" del anfitrion: puede ganar quien abandono y los pausados pasan a abandono (CA-25)', () => {
    let s = started(3);
    s = playQuiz(s, 'B'); // u1 suma 2.500
    s = nextTurn(s, later(10_000));
    s = setPresence(s, HISTORY, 'u1', 'ABANDONED', rng, later(10_000)); // el anfitrion pasa a u2
    s = setPresence(s, HISTORY, 'u3', 'PAUSED', rng, later(10_000));
    s = hostEnd(s, 'u2', later(10_000));
    expect(s.online.endReason).toBe('HOST_ENDED');
    expect(s.winnerIds).toEqual(['p1']);
    expect(s.players[2]!.presence).toBe('ABANDONED');
  });

  it('si nadie esta activo no corre ningun reloj, y arranca al reactivarse alguien (CA-26, CA-27)', () => {
    let s = started(2);
    s = setPresence(s, HISTORY, 'u2', 'PAUSED', rng, T0);
    s = setPresence(s, HISTORY, 'u1', 'PAUSED', rng, T0);
    expect(s.online.phase).toBe('IDLE');
    expect(s.online.deadline).toBeUndefined();
    s = setPresence(s, HISTORY, 'u2', 'ACTIVE', rng, later(1000));
    expect(s.online.phase).toBe('AWAITING_ROLL');
    expect(activeUser(s)).toBe('u2');
  });

  it('quien abandono vuelve con sus millas (CA-22)', () => {
    let s = started(3);
    s = playQuiz(s, 'B');
    s = nextTurn(s, later(10_000));
    s = setPresence(s, HISTORY, 'u1', 'ABANDONED', rng, later(10_000));
    s = setPresence(s, HISTORY, 'u1', 'ACTIVE', rng, later(20_000));
    expect(s.players[0]).toMatchObject({ presence: 'ACTIVE', score: 2500 });
  });

  it('en modo rondas la partida termina aunque los ultimos esten en pausa', () => {
    let s = started(3, { mode: 'ROUNDS', target: 10 });
    s = { ...s, round: 10 };
    s = setPresence(s, HISTORY, 'u3', 'PAUSED', rng, T0);
    s = passTurn(s, 'u1', T0);
    s = passTurn(s, 'u2', T0);
    expect(s.status).toBe('FINISHED');
    expect(s.online.endReason).toBe('ROUNDS');
  });
});

describe('sumarse con la partida empezada (CA-08)', () => {
  it('entra al final del orden con millas iniciales que no cuentan como aciertos', () => {
    let s = started(2);
    s = playQuiz(s, 'B'); // lider con 2.500
    expect(maxInitialMiles(s)).toBe(2500);
    expect(() => addPlayer(s, 'u3', setup(2), 3000)).toThrow(/Millas/);
    expect(() => addPlayer(s, 'u3', setup(2), 700)).toThrow(/Millas/);
    s = addPlayer(s, 'u3', setup(2), 2000);
    expect(s.players[2]).toMatchObject({ id: 'p3', score: 2000, stats: { correct: 0 } });
    expect(s.online.initialMiles.p3).toBe(2000);
  });

  it('el cupo de 6 no cuenta a los que abandonaron, pero conservan su color', () => {
    let s = started(6);
    s = setPresence(s, HISTORY, 'u6', 'ABANDONED', rng, T0);
    expect(() => addPlayer(s, 'u7', { name: 'Siete', color: 'orange', avatar: '🧭' })).toThrow(/color/);
    s = addPlayer(s, 'u7', { name: 'Siete', color: 'pink', avatar: '🧭' });
    expect(s.players).toHaveLength(7);
    expect(() => addPlayer(s, 'u8', { name: 'Ocho', color: 'teal', avatar: '🧭' })).toThrow(/6 jugadores/);
  });
});
