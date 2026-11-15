import { haversineKm } from './geo';
import type { CardOutcome, Difficulty, QuizCategory, ScoreResult } from './types';

/**
 * El puntaje se mide en millas: una casilla del tablero son 500 millas y la vuelta al mundo
 * son 50 casillas (25.000 millas, ~24.900 reales). Todos los premios son casillas enteras.
 */
export const MILES_PER_SPACE = 500;
export const WORLD_TOUR_MILES = 25_000;

const spaces = (n: number) => n * MILES_PER_SPACE;

/** Millas base de las reglas (nivel Facil). */
export const QUIZ_POINTS: Record<QuizCategory, number> = {
  FLAG: spaces(4),
  CITY: spaces(3),
  HISTORY: spaces(5),
  PERSONALITY: spaces(4),
};

/** Tramos de la carta LUGAR: d ≤ maxKm otorga `points` millas (base). */
export const LOCATION_BRACKETS = [
  { maxKm: 100, points: spaces(8) },
  { maxKm: 500, points: spaces(5) },
  { maxKm: 2000, points: spaces(2) },
] as const;

/** Bonus por dificultad en casillas extra: los eventos de viajero no se ven afectados. */
export const DIFFICULTY_BONUS: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: spaces(1),
  HARD: spaces(2),
};

/** Suma el bonus de dificultad; una respuesta que no da millas sigue sin darlas. */
export const withDifficulty = (points: number, difficulty: Difficulty) =>
  points > 0 ? points + DIFFICULTY_BONUS[difficulty] : 0;

/** Millas base de LUGAR segun la distancia (sin bonus). */
export function scoreLocation(distanceKm: number): number {
  for (const bracket of LOCATION_BRACKETS) {
    if (distanceKm <= bracket.maxKm) return bracket.points;
  }
  return 0;
}

export function scoreOutcome(outcome: CardOutcome): ScoreResult {
  switch (outcome.kind) {
    case 'LOCATION': {
      const distanceKm = haversineKm(outcome.guess, outcome.card.location);
      const delta = withDifficulty(scoreLocation(distanceKm), outcome.card.difficulty);
      return { delta, correct: delta > 0, distanceKm };
    }
    case 'QUIZ': {
      const correct = outcome.answer === outcome.card.correctAnswer;
      const points = withDifficulty(QUIZ_POINTS[outcome.card.category], outcome.card.difficulty);
      return { delta: correct ? points : 0, correct };
    }
    case 'EVENT':
      return { delta: outcome.card.points, correct: null };
    case 'TIMEOUT':
      return { delta: 0, correct: false, timedOut: true };
  }
}
