import { haversineKm } from './geo';
import type { CardOutcome, Difficulty, QuizCategory, ScoreResult } from './types';

/** Puntos base de las reglas (nivel Facil). */
export const QUIZ_POINTS: Record<QuizCategory, number> = {
  FLAG: 400,
  CITY: 300,
  HISTORY: 500,
  PERSONALITY: 400,
};

/** Tramos de la carta LUGAR: d ≤ maxKm otorga `points` (base). */
export const LOCATION_BRACKETS = [
  { maxKm: 100, points: 1000 },
  { maxKm: 500, points: 500 },
  { maxKm: 2000, points: 200 },
] as const;

/** Bonus por dificultad: los eventos de viajero no se ven afectados. */
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  EASY: 1,
  MEDIUM: 1.25,
  HARD: 1.5,
};

export const withDifficulty = (points: number, difficulty: Difficulty) =>
  Math.round(points * DIFFICULTY_MULTIPLIER[difficulty]);

/** Puntos base de LUGAR segun la distancia (sin bonus). */
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
  }
}
