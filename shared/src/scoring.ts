import { haversineKm } from './geo';
import type { CardOutcome, QuizCategory, ScoreResult } from './types';

export const QUIZ_POINTS: Record<QuizCategory, number> = {
  FLAG: 400,
  CITY: 300,
  HISTORY: 500,
  PERSONALITY: 400,
};

/** Tramos de la carta LUGAR: d ≤ maxKm otorga `points`. */
export const LOCATION_BRACKETS = [
  { maxKm: 100, points: 1000 },
  { maxKm: 500, points: 500 },
  { maxKm: 2000, points: 200 },
] as const;

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
      const delta = scoreLocation(distanceKm);
      return { delta, correct: delta > 0, distanceKm };
    }
    case 'QUIZ': {
      const correct = outcome.answer === outcome.card.correctAnswer;
      return { delta: correct ? QUIZ_POINTS[outcome.card.category] : 0, correct };
    }
    case 'EVENT':
      return { delta: outcome.card.points, correct: null };
  }
}
