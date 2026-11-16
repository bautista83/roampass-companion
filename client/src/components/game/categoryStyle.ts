import {
  LOCATION_BRACKETS,
  QUIZ_POINTS,
  formatNumber,
  withDifficulty,
  type CardCategory,
} from '@roampass/shared';

const range = (base: number) => `+${formatNumber(base)} a +${formatNumber(withDifficulty(base, 'HARD'))} mi`;

/** Cuantas millas puede dar cada categoria. */
export const POINTS_HINT: Record<CardCategory, string> = {
  LOCATION: `hasta +${formatNumber(withDifficulty(LOCATION_BRACKETS[0].points, 'HARD'))} mi`,
  FLAG: range(QUIZ_POINTS.FLAG),
  CITY: range(QUIZ_POINTS.CITY),
  HISTORY: range(QUIZ_POINTS.HISTORY),
  PERSONALITY: range(QUIZ_POINTS.PERSONALITY),
  TRAVEL_EVENT: '± sorpresa',
};

/** Colores planos de las fichas del tablero, compartidos por las cartas y el dado. */
export const CATEGORY_TINT: Record<CardCategory, string> = {
  LOCATION: 'bg-mint',
  FLAG: 'bg-sky',
  CITY: 'bg-lilac',
  HISTORY: 'bg-sun',
  PERSONALITY: 'bg-coral',
  TRAVEL_EVENT: 'bg-white dark:bg-passport-100',
};

export const CATEGORY_HEX: Record<CardCategory, string> = {
  LOCATION: '#6bcf8b',
  FLAG: '#7ec4f5',
  CITY: '#c7b3ff',
  HISTORY: '#ffd43b',
  PERSONALITY: '#ff8a6b',
  TRAVEL_EVENT: '#ffffff',
};
