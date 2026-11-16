import { describe, expect, it } from 'vitest';
import {
  BOARD,
  BOARD_SPACES,
  DIE_FACES,
  GameRuleError,
  applyTurn,
  boardPosition,
  createGame,
  dieFaceOf,
  isTransportSpace,
  rollDie,
  skipTransportEvent,
  type CardOutcome,
  type GameState,
  type PlayerSetup,
  type QuizCard,
  type TravelEventCard,
} from '../src';

const PLAYERS: PlayerSetup[] = [
  { name: 'Ana', color: 'red', avatar: '🧭' },
  { name: 'Beto', color: 'blue', avatar: '🎒' },
];
const quiz = (category: QuizCard['category']): QuizCard => ({
  id: `q-${category}`,
  category,
  difficulty: 'EASY',
  prompt: '?',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
});
const right = (category: QuizCard['category']): CardOutcome => ({ kind: 'QUIZ', card: quiz(category), answer: 'A' });
const wrong: CardOutcome = { kind: 'QUIZ', card: quiz('FLAG'), answer: 'B' };
const event = (points: number): CardOutcome => ({
  kind: 'EVENT',
  card: { id: `e${points}`, category: 'TRAVEL_EVENT', title: 'x', description: 'x', points, icon: '✈️' } as TravelEventCard,
});

/** Partida digital con Ana parada en `miles`. */
const gameAt = (miles: number): GameState => {
  const g = createGame({ mode: 'POINTS', target: 25_000, board: 'DIGITAL' }, PLAYERS);
  return { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, score: miles } : p)) };
};

// Casilla 13 (6.500 mi) es el barco por el Atlantico; la 18 (9.000 mi), el globo en Capadocia.
const FIRST_TRANSPORT = 13;

describe('tablero', () => {
  it('tiene 50 casillas con su camino y los transportes del recorrido', () => {
    expect(BOARD_SPACES).toBe(50);
    expect(BOARD.legs).toHaveLength(50);
    expect(BOARD.spaces[0]!.id).toBe('obelisco');
    expect(BOARD.spaces.filter((s) => s.type === 'transport')).toHaveLength(7);
    expect(isTransportSpace(FIRST_TRANSPORT)).toBe(true);
    expect(isTransportSpace(18)).toBe(true);
  });

  it.each([
    [0, 0, 0],
    [499, 0, 0],
    [500, 0, 1],
    [24_999, 0, 49],
    [25_000, 1, 0],
    [26_500, 1, 3],
  ])('%d mi → vuelta %d, casilla %d', (miles, lap, space) => {
    expect(boardPosition(miles)).toEqual({ lap, space });
  });
});

describe('dado', () => {
  it('cada cara es una categoria (1 Lugar ... 6 Evento)', () => {
    expect(DIE_FACES).toEqual(['LOCATION', 'FLAG', 'CITY', 'HISTORY', 'PERSONALITY', 'TRAVEL_EVENT']);
    expect(dieFaceOf('LOCATION')).toBe(1);
    expect(dieFaceOf('TRAVEL_EVENT')).toBe(6);
  });

  it('vuelve a tirar solo si sale una categoria agotada', () => {
    const faces = [2, 2, 4]; // Bandera agotada dos veces y despues Historia
    const random = () => (faces.shift()! - 1) / 6;
    expect(rollDie((c) => c !== 'FLAG', random)).toEqual({ face: 4, category: 'HISTORY', rerolls: [2, 2] });
    expect(rollDie(() => false)).toBeNull();
  });
});

describe('casillas de transporte', () => {
  it('acertar una carta y caer en un transporte obliga a jugar un evento en el mismo turno', () => {
    const { state } = applyTurn(gameAt(5_000), right('CITY')); // +1.500 → 6.500 (casilla 13)
    expect(state.transportEvent).toBe(true);
    expect(state.currentPlayerIndex).toBe(0);
    expect(() => applyTurn(state, right('FLAG'))).toThrow(GameRuleError);

    const after = applyTurn(state, event(500)).state;
    expect(after.transportEvent).toBeUndefined();
    expect(after.players[0]!.score).toBe(7_000);
    expect(after.currentPlayerIndex).toBe(1);
  });

  it('el evento del transporte no encadena aunque deje la ficha en otro transporte', () => {
    const pending = applyTurn(gameAt(5_000), right('CITY')).state;
    const after = applyTurn(pending, event(2_500)).state; // 9.000 → casilla 18, tambien transporte
    expect(boardPosition(after.players[0]!.score).space).toBe(18);
    expect(after.transportEvent).toBeUndefined();
    expect(after.currentPlayerIndex).toBe(1);
  });

  it('llegar a un transporte por un evento (cara 6 del dado) no hace nada', () => {
    const { state } = applyTurn(gameAt(6_000), event(500));
    expect(boardPosition(state.players[0]!.score).space).toBe(FIRST_TRANSPORT);
    expect(state.transportEvent).toBeUndefined();
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('cuenta caer, no estar: responder mal parado en un transporte no dispara nada', () => {
    const { state } = applyTurn(gameAt(6_500), wrong);
    expect(state.transportEvent).toBeUndefined();
    expect(state.currentPlayerIndex).toBe(1);
  });

  it('sin eventos en el mazo, la ficha queda en el transporte y pasa el turno', () => {
    const pending = applyTurn(gameAt(5_000), right('CITY')).state;
    const skipped = skipTransportEvent(pending);
    expect(skipped.transportEvent).toBeUndefined();
    expect(skipped.currentPlayerIndex).toBe(1);
    expect(skipped.players[0]!.score).toBe(6_500);
  });

  it('las partidas sin modo de tablero se siguen creando y el modo invalido se rechaza', () => {
    expect(createGame({ mode: 'POINTS', target: 25_000 }, PLAYERS).config.board).toBeUndefined();
    expect(() =>
      createGame({ mode: 'POINTS', target: 25_000, board: 'OTRO' as 'DIGITAL' }, PLAYERS),
    ).toThrow(GameRuleError);
  });
});
