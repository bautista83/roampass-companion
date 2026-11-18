// Reglas del juego explicadas en lenguaje simple. Todos los numeros salen de las constantes del motor,
// asi que si cambia un puntaje, una meta o un tiempo, las reglas (pantalla y PDF) se actualizan solas.
// Los textos estan en el diccionario de cada idioma (shared/src/locales).

import { BOARD, BOARD_SPACES, DIE_FACES, dieFaceOf } from './board';
import { MAX_PLAYERS, MIN_PLAYERS, MIN_SCORE } from './engine';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { categoryMeta, difficultyMeta, formatMiles, formatNumber } from './labels';
import { sharedTexts } from './locales';
import { DIFFICULTY_BONUS, LOCATION_BRACKETS, MILES_PER_SPACE, QUIZ_POINTS, WORLD_TOUR_MILES, withDifficulty } from './scoring';
import {
  DEFAULT_TIMER_SECONDS,
  DIFFICULTIES,
  POINT_TARGETS,
  ROUND_TARGETS,
  TIMER_OPTIONS,
  type CardCategory,
  type Difficulty,
  type QuizCategory,
} from './types';

/** Nombre corto de la meta en millas: media vuelta / vuelta completa. */
export function pointTargetLabel(miles: number, locale: Locale = DEFAULT_LOCALE): string {
  const t = sharedTexts(locale).pointTarget;
  return miles === WORLD_TOUR_MILES ? t.full : miles * 2 === WORLD_TOUR_MILES ? t.half : t.other;
}

export type RulesSectionId = 'goal' | 'setup' | 'turn' | 'cards' | 'travel' | 'win';

export interface RulesSection {
  id: RulesSectionId;
  icon: string;
  title: string;
  /** Una o dos frases que resumen el paso. */
  summary: string;
  /** Puntos clave, en orden. */
  points: string[];
}

const SECTION_ORDER: { id: RulesSectionId; icon: string }[] = [
  { id: 'goal', icon: '🌍' },
  { id: 'setup', icon: '🧳' },
  { id: 'turn', icon: '🎲' },
  { id: 'cards', icon: '🃏' },
  { id: 'travel', icon: '🛂' },
  { id: 'win', icon: '🏆' },
];

const QUIZ_ORDER: QuizCategory[] = ['FLAG', 'CITY', 'HISTORY', 'PERSONALITY'];

/** Todo lo que muestran la guia de reglas y el PDF, en un idioma. */
export function buildRules(locale: Locale = DEFAULT_LOCALE) {
  const texts = sharedTexts(locale);
  const categories = categoryMeta(locale);
  const levels = difficultyMeta(locale);
  const list = (items: readonly (string | number)[], joiner: 'and' | 'or') =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${texts.list[joiner]} ${items.at(-1)}`;

  /** Caras del dado: numero -> categoria. */
  const die = DIE_FACES.map((category, i) => ({
    face: i + 1,
    category,
    label: categories[category].label,
    icon: categories[category].icon,
  }));

  /** Millas de las cartas de pregunta segun el nivel. */
  const quizPoints = QUIZ_ORDER.map((category) => ({
    category: category as CardCategory,
    label: categories[category].label,
    icon: categories[category].icon,
    byDifficulty: Object.fromEntries(DIFFICULTIES.map((d) => [d, withDifficulty(QUIZ_POINTS[category], d)])) as Record<
      Difficulty,
      number
    >,
  }));

  /** Tramos de distancia de la carta LUGAR (millas base, nivel Facil). */
  const locationBrackets = LOCATION_BRACKETS.map((b, i) => ({
    fromKm: i === 0 ? 0 : LOCATION_BRACKETS[i - 1]!.maxKm,
    maxKm: b.maxKm,
    points: b.points,
  }));

  /** Niveles de las cartas y el bonus que suman. */
  const difficulties = DIFFICULTIES.map((d) => ({ difficulty: d, label: levels[d].label, bonus: DIFFICULTY_BONUS[d] }));

  const { physicalBoard, sections } = texts.rules({
    mi: (n) => formatMiles(n, locale),
    num: (n) => formatNumber(n, locale),
    list,
    start: BOARD.spaces[0]!.name,
    milesPerSpace: MILES_PER_SPACE,
    boardSpaces: BOARD_SPACES,
    worldTourMiles: WORLD_TOUR_MILES,
    pointTargets: POINT_TARGETS.map((miles) => ({ miles, label: pointTargetLabel(miles, locale) })),
    roundTargets: ROUND_TARGETS,
    timerOptions: TIMER_OPTIONS,
    defaultTimer: DEFAULT_TIMER_SECONDS,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    difficulties,
    locationLabel: categories.LOCATION.label,
    travelEventLabel: categories.TRAVEL_EVENT.label,
    lastBracketKm: LOCATION_BRACKETS.at(-1)!.maxKm,
    eventFace: dieFaceOf('TRAVEL_EVENT'),
    minScore: MIN_SCORE,
  });

  return {
    die,
    quizPoints,
    locationBrackets,
    difficulties,
    /** Casillas de transporte del tablero. */
    transports: BOARD.spaces.filter((s) => s.type === 'transport').map((s) => ({ id: s.id, name: s.name })),
    /** Como se juega con el tablero impreso y el dado fisico (la app hace de mazo y marcador). */
    physicalBoard,
    sections: SECTION_ORDER.map(({ id, icon }): RulesSection => ({ id, icon, ...sections[id] })),
  };
}

export type Rules = ReturnType<typeof buildRules>;

// Version en el idioma por defecto (compatibilidad).
const defaultRules = buildRules();
export const RULES_DIE = defaultRules.die;
export const RULES_QUIZ_POINTS = defaultRules.quizPoints;
export const RULES_LOCATION_BRACKETS = defaultRules.locationBrackets;
export const RULES_DIFFICULTIES = defaultRules.difficulties;
export const RULES_TRANSPORTS = defaultRules.transports;
export const RULES_PHYSICAL_BOARD = defaultRules.physicalBoard;
export const RULES_SECTIONS = defaultRules.sections;
