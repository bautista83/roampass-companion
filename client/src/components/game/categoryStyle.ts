import type { CardCategory } from '@roampass/shared';

// Las millas que da cada categoria, en texto, estan en usePointsHint (dependen del idioma).

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
