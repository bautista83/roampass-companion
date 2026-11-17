// Reglas del juego explicadas en lenguaje simple. Todos los numeros salen de las constantes del motor,
// asi que si cambia un puntaje, una meta o un tiempo, las reglas (pantalla y PDF) se actualizan solas.

import { BOARD, BOARD_SPACES, DIE_FACES, dieFaceOf } from './board';
import { MAX_PLAYERS, MIN_PLAYERS, MIN_SCORE } from './engine';
import { CATEGORY_META, DIFFICULTY_META, formatNumber } from './labels';
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

const mi = (n: number) => `${formatNumber(n)} mi`;

/** "a, b y c" (o "a, b o c"). */
const list = (items: readonly (string | number)[], joiner: 'y' | 'o' = 'y') =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${joiner} ${items.at(-1)}`;

/** Nombre corto de la meta en millas: media vuelta / vuelta completa. */
export const pointTargetLabel = (miles: number) =>
  miles === WORLD_TOUR_MILES ? 'vuelta completa' : miles * 2 === WORLD_TOUR_MILES ? 'media vuelta' : 'meta';

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

/** Caras del dado: numero -> categoria. */
export const RULES_DIE = DIE_FACES.map((category, i) => ({
  face: i + 1,
  category,
  label: CATEGORY_META[category].label,
  icon: CATEGORY_META[category].icon,
}));

const QUIZ_ORDER: QuizCategory[] = ['FLAG', 'CITY', 'HISTORY', 'PERSONALITY'];

/** Millas de las cartas de pregunta segun el nivel. */
export const RULES_QUIZ_POINTS = QUIZ_ORDER.map((category) => ({
  category: category as CardCategory,
  label: CATEGORY_META[category].label,
  icon: CATEGORY_META[category].icon,
  byDifficulty: Object.fromEntries(
    DIFFICULTIES.map((d) => [d, withDifficulty(QUIZ_POINTS[category], d)]),
  ) as Record<Difficulty, number>,
}));

/** Tramos de distancia de la carta LUGAR (millas base, nivel Facil). */
export const RULES_LOCATION_BRACKETS = LOCATION_BRACKETS.map((b, i) => ({
  fromKm: i === 0 ? 0 : LOCATION_BRACKETS[i - 1]!.maxKm,
  maxKm: b.maxKm,
  points: b.points,
}));

/** Niveles de las cartas y el bonus que suman. */
export const RULES_DIFFICULTIES = DIFFICULTIES.map((d) => ({
  difficulty: d,
  label: DIFFICULTY_META[d].label,
  bonus: DIFFICULTY_BONUS[d],
}));

/** Casillas de transporte del tablero. */
export const RULES_TRANSPORTS = BOARD.spaces
  .filter((s) => s.type === 'transport')
  .map((s) => ({ id: s.id, name: s.name }));

const START = BOARD.spaces[0]!.name;
const lastBracket = LOCATION_BRACKETS.at(-1)!;
const eventFace = dieFaceOf('TRAVEL_EVENT');

/** Como se juega con el tablero impreso y el dado fisico (la app hace de mazo y marcador). */
export const RULES_PHYSICAL_BOARD: string[] = [
  `Cada jugador pone su ficha en la salida: ${START}.`,
  'Tirá el dado físico (o tocá el dado de la app) y tocá en la app la carta del número que salió.',
  `Cuando sumás millas, mové tu ficha una casilla por cada ${mi(MILES_PER_SPACE)}. Si un evento te resta millas, retrocedé.`,
  'El marcador de la app muestra en qué casilla tiene que estar cada ficha.',
];

export const RULES_SECTIONS: RulesSection[] = [
  {
    id: 'goal',
    icon: '🌍',
    title: 'De qué se trata',
    summary:
      'Son viajeros dando la vuelta al mundo. Cada respuesta correcta da millas, y con las millas la ficha avanza por el tablero.',
    points: [
      `Cada casilla del tablero vale ${mi(MILES_PER_SPACE)}.`,
      `La vuelta al mundo completa son ${BOARD_SPACES} casillas: ${mi(WORLD_TOUR_MILES)}.`,
      `Todos salen de la misma casilla: ${START}.`,
    ],
  },
  {
    id: 'setup',
    icon: '🧳',
    title: 'Cómo empezar',
    summary: 'En el panel tocá «Crear Nueva Partida» y seguí los pasos.',
    points: [
      'Elegí el tablero: el impreso con un dado físico, o el tablero digital en la pantalla.',
      `Elegí la meta: llegar a ${list(POINT_TARGETS.map((t) => `${mi(t)} (${pointTargetLabel(t)})`), 'o')}, o jugar ${list(ROUND_TARGETS, 'o')} rondas.`,
      `Elegí el tiempo para responder cada carta: ${list(TIMER_OPTIONS, 'o')} segundos (si no elegís, ${DEFAULT_TIMER_SECONDS}).`,
      `Sumá de ${MIN_PLAYERS} a ${MAX_PLAYERS} jugadores, cada uno con su color de ficha y su avatar.`,
    ],
  },
  {
    id: 'turn',
    icon: '🎲',
    title: 'Tu turno',
    summary: 'Se juega por turnos, uno por persona. Cada turno tiene cuatro pasos:',
    points: [
      'Tirá el dado: cada número es una categoría de carta.',
      'Se abre una carta de esa categoría y arranca el reloj.',
      'Respondé antes de que se termine el tiempo. Si se termina, la carta cuenta como error.',
      'Si acertás, sumás millas y tu ficha avanza. Después le toca al siguiente.',
    ],
  },
  {
    id: 'cards',
    icon: '🃏',
    title: 'Las cartas y sus millas',
    summary: 'Cada categoría da distintas millas. Una respuesta incorrecta da 0.',
    points: [
      `Las cartas tienen nivel: ${list(RULES_DIFFICULTIES.map((d) => `${d.label} (+${formatNumber(d.bonus)})`))} millas extra.`,
      `En las cartas de ${CATEGORY_META.LOCATION.label} ves una foto o Street View y marcás en el mapa dónde creés que es. Cuanto más cerca, más millas; a más de ${formatNumber(lastBracket.maxKm)} km no suma.`,
      'Ninguna carta se repite en la partida. Si una categoría se queda sin cartas, aparece «Agotada».',
    ],
  },
  {
    id: 'travel',
    icon: '🛂',
    title: 'Eventos y transportes',
    summary: `Las cartas de ${CATEGORY_META.TRAVEL_EVENT.label} no tienen pregunta: te hacen avanzar o retroceder casillas.`,
    points: [
      `Salen con el ${eventFace} del dado.`,
      `Si después de acertar una carta tu ficha cae en una casilla de transporte, en el mismo turno jugás también un ${CATEGORY_META.TRAVEL_EVENT.label}.`,
      'Pasar por encima de un transporte no cuenta, y si llegás por un evento tampoco.',
      `Las millas nunca bajan de ${MIN_SCORE}.`,
    ],
  },
  {
    id: 'win',
    icon: '🏆',
    title: 'Cómo se gana',
    summary: 'Depende de la meta que eligieron al empezar.',
    points: [
      'Por millas: gana quien llega primero a la meta, y la partida termina en ese momento.',
      'Por rondas: cuando se termina la última ronda, gana quien tiene más millas.',
      'Si hay empate, gana quien tiene más aciertos. Si siguen iguales, comparten el puesto.',
      'Con «Terminar ahora» la partida se cierra antes y gana quien va primero.',
    ],
  },
];
