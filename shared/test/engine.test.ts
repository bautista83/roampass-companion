import { describe, expect, it } from 'vitest';
import seed from '../data/seedData.json';
import countryData from '../data/countries.json';
import {
  applyTurn,
  createGame,
  drawCard,
  generateCountryCards,
  remainingByCategory,
  finish,
  GameRuleError,
  haversineKm,
  rankPlayers,
  scoreLocation,
  scoreOutcome,
  type Card,
  type CardOutcome,
  type CountryData,
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

const quiz = (category: QuizCard['category'], difficulty: QuizCard['difficulty'] = 'EASY'): QuizCard => ({
  id: `q-${category}-${difficulty}`,
  category,
  difficulty,
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
  it('aplica el bonus por dificultad (x1 / x1,25 / x1,5)', () => {
    expect(scoreOutcome({ kind: 'QUIZ', card: quiz('CITY', 'MEDIUM'), answer: 'A' }).delta).toBe(375);
    expect(scoreOutcome({ kind: 'QUIZ', card: quiz('HISTORY', 'HARD'), answer: 'A' }).delta).toBe(750);
    expect(scoreOutcome({ kind: 'QUIZ', card: quiz('HISTORY', 'HARD'), answer: 'B' }).delta).toBe(0);
    expect(scoreOutcome({ kind: 'EVENT', card: event(-300) }).delta).toBe(-300);
  });
  it('calcula la distancia en cartas de LUGAR', () => {
    const card = deck.find((c) => c.id === 'loc-machu-picchu') as LocationCard;
    const r = scoreOutcome({ kind: 'LOCATION', card, guess: { lat: -13.5, lng: -72 } });
    expect(r.delta).toBe(1000);
    const hard = deck.find((c) => c.id === 'loc-deadvlei') as LocationCard;
    expect(scoreOutcome({ kind: 'LOCATION', card: hard, guess: hard.location }).delta).toBe(1500);
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
  it('nunca repite una carta en la partida y avisa cuando se agota', () => {
    const locations = deck.filter((c) => c.category === 'LOCATION');
    const used: string[] = [];
    for (let i = 0; i < locations.length; i++) used.push(drawCard<Card>(deck, 'LOCATION', used)!.id);
    expect(new Set(used).size).toBe(locations.length);
    expect(drawCard(deck, 'LOCATION', used)).toBeNull();
    expect(remainingByCategory(deck, used).LOCATION).toBe(0);
    expect(remainingByCategory(deck, used).HISTORY).toBe(deck.filter((c) => c.category === 'HISTORY').length);
  });
});

describe('generateCountryCards', () => {
  const generated = generateCountryCards(countryData as CountryData, deck);
  const all = [...deck, ...generated];

  it('genera banderas y capitales validas, sin duplicar las escritas a mano', () => {
    expect(generated.filter((c) => c.category === 'FLAG').length).toBeGreaterThan(180);
    expect(generated.filter((c) => c.category === 'CITY').length).toBeGreaterThan(160);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const c of generated) {
      expect(new Set(c.options).size, c.id).toBe(4);
      expect(c.options, c.id).toContain(c.correctAnswer);
    }
    expect(generated.some((c) => c.id === 'gen-flag-ar')).toBe(false);
    expect(generated.some((c) => c.id === 'gen-capital-au')).toBe(false);
  });

  it('el nivel dificil usa banderas parecidas y ciudades trampa', () => {
    const chad = generated.find((c) => c.id === 'gen-flag-ro')!;
    expect(chad.options).toContain('Chad');
    const brazil = generated.find((c) => c.id === 'gen-capital-br')!;
    expect(brazil.correctAnswer).toBe('Brasilia');
  });

  it('es determinista (mismas opciones en todos los dispositivos)', () => {
    expect(generateCountryCards(countryData as CountryData, deck)).toEqual(generated);
  });
});

describe('seedData.json', () => {
  it('tiene al menos 3 cartas por categoria y respuestas validas', () => {
    for (const cat of ['LOCATION', 'FLAG', 'CITY', 'HISTORY', 'PERSONALITY', 'TRAVEL_EVENT']) {
      expect(deck.filter((c) => c.category === cat).length).toBeGreaterThanOrEqual(3);
    }
    for (const c of deck) {
      if (c.category !== 'TRAVEL_EVENT') expect(['EASY', 'MEDIUM', 'HARD'], c.id).toContain(c.difficulty);
      if ('options' in c) {
        expect(c.options).toHaveLength(4);
        expect(c.options).toContain(c.correctAnswer);
      }
    }
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
  });
});
