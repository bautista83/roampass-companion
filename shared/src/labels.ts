import { DEFAULT_LOCALE, type Locale } from './i18n';
import { sharedTexts } from './locales';
import { DIFFICULTY_BONUS } from './scoring';
import { CARD_CATEGORIES, DIFFICULTIES, PAWN_COLORS, type CardCategory, type Difficulty, type PawnColor } from './types';

// Los textos salen del diccionario del idioma (shared/src/locales); aca quedan los datos que no se
// traducen (iconos, colores). Las constantes en MAYUSCULAS son la version en el idioma por defecto.

const CATEGORY_ICONS: Record<CardCategory, string> = {
  LOCATION: '📍',
  FLAG: '🏁',
  CITY: '🏙️',
  HISTORY: '📜',
  PERSONALITY: '👤',
  TRAVEL_EVENT: '🛂',
};

const PAWN_HEX: Record<PawnColor, string> = {
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#eab308',
  purple: '#9333ea',
  orange: '#ea580c',
  pink: '#db2777',
  teal: '#0d9488',
};

const numberFormats = new Map<string, Intl.NumberFormat>();
/** Numero con separador de miles. En 'es' los de 4 cifras no se agrupan (3000 vs 10.000): se fuerza. */
export function formatNumber(n: number, locale: Locale = DEFAULT_LOCALE): string {
  const intl = sharedTexts(locale).intl;
  let format = numberFormats.get(intl);
  if (!format) {
    format = new Intl.NumberFormat(intl, { useGrouping: 'always' as unknown as boolean });
    numberFormats.set(intl, format);
  }
  return format.format(n);
}

/** "4.000 mi" */
export const formatMiles = (n: number, locale: Locale = DEFAULT_LOCALE) => `${formatNumber(n, locale)} ${sharedTexts(locale).milesUnit}`;

export const categoryMeta = (locale: Locale = DEFAULT_LOCALE): Record<CardCategory, { label: string; icon: string; hint: string }> => {
  const t = sharedTexts(locale).categories;
  return Object.fromEntries(CARD_CATEGORIES.map((c) => [c, { ...t[c], icon: CATEGORY_ICONS[c] }])) as Record<
    CardCategory,
    { label: string; icon: string; hint: string }
  >;
};

/** `short`: bonus de millas que suma el nivel ("+500 mi"); vacio en Facil. */
export const difficultyMeta = (locale: Locale = DEFAULT_LOCALE): Record<Difficulty, { label: string; short: string }> => {
  const t = sharedTexts(locale).difficulties;
  const short = (d: Difficulty) => (DIFFICULTY_BONUS[d] > 0 ? `+${formatMiles(DIFFICULTY_BONUS[d], locale)}` : '');
  return Object.fromEntries(DIFFICULTIES.map((d) => [d, { label: t[d].label, short: short(d) }])) as Record<
    Difficulty,
    { label: string; short: string }
  >;
};

export const pawnColorMeta = (locale: Locale = DEFAULT_LOCALE): Record<PawnColor, { label: string; hex: string }> => {
  const t = sharedTexts(locale).pawnColors;
  return Object.fromEntries(PAWN_COLORS.map((c) => [c, { label: t[c], hex: PAWN_HEX[c] }])) as Record<
    PawnColor,
    { label: string; hex: string }
  >;
};

export const CATEGORY_META = categoryMeta();
export const DIFFICULTY_META = difficultyMeta();
export const PAWN_COLOR_META = pawnColorMeta();
