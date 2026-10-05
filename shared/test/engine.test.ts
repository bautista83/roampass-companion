import { describe, expect, it } from 'vitest';
import seed from '../data/seedData.json';
import {
  applyTurn,
  createGame,
  drawCard,
  finish,
  GameRuleError,
  haversineKm,
  rankPlayers,
  scoreLocation,
  scoreOutcome,
  type Card,
  type CardOutcome,
  type LocationCard,
  type PlayerSetup,
  type QuizCard,
  type SeedData,
  type TravelEventCard,
} from '../src';

const deck = (seed as SeedData).cards;
const PLAYERS: PlayerSetup[] = [
  { name: 'Ana', color: 'red', avatar: '🧭' },
  { name: 'Beto', color: 'blue', avatar: '🎒' },
];

const quiz = (category: QuizCard['category']): QuizCard => ({
  id: `q-${category}`,
  category,
  prompt: '?',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
});
const event = (points: number): TravelEventCard => ({
  id: `e${points}`,
  category: 'TRAVEL_EVENT',
  title: 'x',
  description: 'x',
  points,
  icon: '✈️',
});
const right = (category: QuizCard['category'] = 'HISTORY'): CardOutcome => ({
  kind: 'QUIZ',
  card: quiz(category),
  answer: 'A',
});
const wrong: CardOutcome = { kind: 'QUIZ', card: quiz('FLAG'), answer: 'B' };

describe('haversineKm', () => {
  it('es 0 para el mismo punto', () => {
    expect(haversineKm({ lat: 10, lng: 20 }, { lat: 10, lng: 20 })).toBe(0);
  });
  it('Madrid - Buenos Aires ≈ 10.040 km', () => {
    const d = haversineKm({ lat: 40.4168, lng: -3.7038 }, { lat: -34.6037, lng: -58.3816 });
    expect(d).toBeGreaterThan(10000);
    expect(d).toBeLessThan(10100);
  });
  it('Paris - Londres ≈ 344 km', () => {
    expect(haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 })).toBeCloseTo(344, -1);
  });
});

describe('scoreLocation', () => {
  it.each([
    [0, 1000],
    [100, 1000],
    [100.01, 500],
    [500, 500],
    [501, 200],
    [2000, 200],
    [2000.5, 0],
    [15000, 0],
  ])('%d km → %d pts', (km, pts) => expect(scoreLocation(km)).toBe(pts));
});

describe('scoreOutcome', () => {
  it('aplica los puntos por categoria de quiz', () => {
    expect(scoreOutcome(right('FLAG')).delta).toBe(400);
    expect(scoreOutcome(right('CITY')).delta).toBe(300);
    expect(scoreOutcome(right('HISTORY')).delta).toBe(500);
    expect(scoreOutcome(right('PERSONALITY')).delta).toBe(400);
    expect(scoreOutcome(wrong)).toEqual({ delta: 0, correct: false });
  });
  it('calcula la distancia en cartas de LUGAR', () => {
    const card = deck.find((c) => c.id === 'loc-machu-picchu') as LocationCard;
    const r = scoreOutcome({ kind: 'LOCATION', card, guess: { lat: -13.5, lng: -72 } });
    expect(r.delta).toBe(1000);
    expect(r.distanceKm).toBeGreaterThan(0);
  });
});

describe('turnos y victoria', () => {
  it('alterna jugadores y avanza la ronda al dar la vuelta', () => {
    let g = createGame({ mode: 'ROUNDS', target: 10 }, PLAYERS);
    g = applyTurn(g, wrong).state;
    expect([g.currentPlayerIndex, g.round]).toEqual([1, 1]);
    g = applyTurn(g, wrong).state;
    expect([g.currentPlayerIndex, g.round]).toEqual([0, 2]);
  });

  it('modo ROUNDS termina al completar la ultima ronda', () => {
    let g = createGame({ mode: 'ROUNDS', target: 10 }, PLAYERS);
    for (let i = 0; i < 19; i++) g = applyTurn(g, i % 2 ? wrong : right()).state;
    expect(g.status).toBe('PLAYING');
    g = applyTurn(g, wrong).state;
    expect(g.status).toBe('FINISHED');
    expect(g.round).toBe(10);
    expect(g.winnerIds).toEqual(['p1']);
    expect(() => applyTurn(g, wrong)).toThrow(GameRuleError);
  });

  it('modo POINTS termina en cuanto alguien llega a la meta', () => {
    let g = createGame({ mode: 'POINTS', target: 3000 }, PLAYERS);
    for (let i = 0; i < 11; i++) g = applyTurn(g, i % 2 ? wrong : right()).state;
    expect(g.players[0]!.score).toBe(3000);
    expect(g.status).toBe('FINISHED');
    expect(g.winnerIds).toEqual(['p1']);
  });

  it('el puntaje no baja de 0 y el delta registrado es el efectivo', () => {
    const g = createGame({ mode: 'POINTS', target: 3000 }, PLAYERS);
    const { state, result } = applyTurn(g, { kind: 'EVENT', card: event(-300) });
    expect(state.players[0]!.score).toBe(0);
    expect(result.delta).toBe(0);
    expect(state.history[0]!.correct).toBeNull();
  });

  it('valida configuracion y jugadores', () => {
    expect(() => createGame({ mode: 'POINTS', target: 1234 }, PLAYERS)).toThrow(GameRuleError);
    expect(() => createGame({ mode: 'ROUNDS', target: 10 }, [PLAYERS[0]!])).toThrow(GameRuleError);
    expect(() =>
      createGame({ mode: 'ROUNDS', target: 10 }, [PLAYERS[0]!, { ...PLAYERS[1]!, color: 'red' }]),
    ).toThrow(/color/);
  });

  it('finish adelantado y empates comparten posicion', () => {
    let g = createGame({ mode: 'ROUNDS', target: 10 }, [...PLAYERS, { name: 'Caro', color: 'green', avatar: '📸' }]);
    g = applyTurn(g, right()).state;
    g = applyTurn(g, right()).state;
    g = finish(g);
    expect(g.winnerIds).toEqual(['p1', 'p2']);
    expect(rankPlayers(g.players).map((r) => r.position)).toEqual([1, 1, 3]);
  });
});

describe('drawCard', () => {
  it('no repite cartas hasta agotar la categoria', () => {
    const flags = deck.filter((c) => c.category === 'FLAG');
    const used: string[] = [];
    for (let i = 0; i < flags.length; i++) used.push(drawCard<Card>(deck, 'FLAG', used).id);
    expect(new Set(used).size).toBe(flags.length);
    expect(drawCard(deck, 'FLAG', used).category).toBe('FLAG');
  });
});

describe('seedData.json', () => {
  it('tiene al menos 3 cartas por categoria y respuestas validas', () => {
    for (const cat of ['LOCATION', 'FLAG', 'CITY', 'HISTORY', 'PERSONALITY', 'TRAVEL_EVENT']) {
      expect(deck.filter((c) => c.category === cat).length).toBeGreaterThanOrEqual(3);
    }
    for (const c of deck) {
      if ('options' in c) {
        expect(c.options).toHaveLength(4);
        expect(c.options).toContain(c.correctAnswer);
      }
    }
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });
});
