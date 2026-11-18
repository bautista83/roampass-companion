import type { Locale } from './i18n';

// Tipos de dominio compartidos entre cliente y servidor.

export type Role = 'ADMIN' | 'PLAYER';

/** Estilo visual que cada usuario elige en su perfil. COMIC es el estilo base (login incluido). */
export type UiTheme = 'COMIC' | 'RETRO';
export const UI_THEMES: readonly UiTheme[] = ['COMIC', 'RETRO'];

export type CardCategory = 'LOCATION' | 'FLAG' | 'CITY' | 'HISTORY' | 'PERSONALITY' | 'TRAVEL_EVENT';

export type QuizCategory = 'FLAG' | 'CITY' | 'HISTORY' | 'PERSONALITY';

export const CARD_CATEGORIES: readonly CardCategory[] = [
  'LOCATION',
  'FLAG',
  'CITY',
  'HISTORY',
  'PERSONALITY',
  'TRAVEL_EVENT',
];

/** Nivel de una carta. En modo mixto salen todas y las dificiles valen mas (ver DIFFICULTY_BONUS). */
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const DIFFICULTIES: readonly Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export type VictoryMode = 'POINTS' | 'ROUNDS';

/** Metas en millas: media vuelta al mundo (25 casillas) o la vuelta completa (50 casillas). */
export const POINT_TARGETS = [12_500, 25_000] as const;

/** Segundos para responder cada carta; se elige al crear cada partida (los eventos de viajero no tienen timer). */
export const TIMER_OPTIONS = [10, 15, 20, 25, 30] as const;
export const DEFAULT_TIMER_SECONDS = 10;
export const ROUND_TARGETS = [10, 15, 20] as const;

/** PHYSICAL: tablero impreso y tarjetas en la app. DIGITAL: el tablero se juega en pantalla. */
export type BoardMode = 'PHYSICAL' | 'DIGITAL';

export interface VictoryCondition {
  mode: VictoryMode;
  /** Partidas anteriores a esta opcion no lo tienen: se toman como PHYSICAL. */
  board?: BoardMode;
  /** Millas a alcanzar (modo POINTS) o rondas a jugar (modo ROUNDS). */
  target: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Credito de la imagen (licencias CC de Wikimedia Commons requieren atribucion). */
export interface ImageCredit {
  author?: string;
  license: string;
  source: string;
}

/**
 * Textos de una carta en otro idioma. El texto base (prompt, options...) esta en el idioma por
 * defecto; lo que falte en la traduccion se muestra en ese idioma. Las opciones traducidas van en
 * el mismo orden que las originales (la respuesta correcta se busca por posicion).
 */
export interface CardTranslation {
  prompt?: string;
  options?: string[];
  funFact?: string;
  /** LOCATION: nombre del lugar. */
  answerLabel?: string;
  /** TRAVEL_EVENT */
  title?: string;
  description?: string;
}

interface BaseCard {
  id: string;
  category: CardCategory;
  /** Traducciones opcionales (ver localizeCard). */
  translations?: Partial<Record<Locale, CardTranslation>>;
}

export interface LocationCard extends BaseCard {
  category: 'LOCATION';
  difficulty: Difficulty;
  prompt: string;
  /**
   * Foto del lugar. Si no tiene, es una carta de Street View: `location` es un punto de una
   * calle o camino con cobertura y se muestra con la Maps Embed API (requiere API key).
   */
  imageUrl?: string;
  location: LatLng;
  /** Nombre del lugar revelado tras responder. */
  answerLabel: string;
  credit?: ImageCredit;
}

export interface QuizCard extends BaseCard {
  category: QuizCategory;
  difficulty: Difficulty;
  prompt: string;
  imageUrl?: string;
  /** Codigo ISO 3166-1 alpha-2: en FLAG resuelve la imagen via FlagCDN; en CITY evita duplicar capitales generadas. */
  countryCode?: string;
  options: string[];
  correctAnswer: string;
  funFact?: string;
  credit?: ImageCredit;
}

export interface TravelEventCard extends BaseCard {
  category: 'TRAVEL_EVENT';
  title: string;
  description: string;
  /** Millas que avanza (+) o retrocede (-) el viajero; siempre casillas enteras (multiplo de 500). */
  points: number;
  icon: string;
}

export type Card = LocationCard | QuizCard | TravelEventCard;

/** Pais del listado local (shared/data/countries.json) usado para generar banderas y capitales. */
export interface Country {
  code: string;
  name: string;
  /** null si tiene varias capitales oficiales o la pregunta seria trivial. */
  capital: string | null;
  /** Capital en otros idiomas (si falta, se usa `capital`). */
  capitalTranslations?: Partial<Record<Locale, string>>;
  region: string;
  /** Posicion en el ranking de popularidad (0 = mas conocido). Define el nivel. */
  fame: number;
}

export interface CountryData {
  regions: Record<string, string>;
  countries: Country[];
  similarFlags: string[][];
  decoyCities: Record<string, string[]>;
}

export interface SeedData {
  version: number;
  cards: Card[];
}

export const PAWN_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type PawnColor = (typeof PAWN_COLORS)[number];

export const AVATARS = ['🧭', '🎒', '🗺️', '📸', '🏕️', '🚂', '⛵', '🐪'] as const;

export interface PlayerSetup {
  name: string;
  color: PawnColor;
  avatar: string;
}

export interface PlayerStats {
  cardsPlayed: number;
  correct: number;
  wrong: number;
  pointsByCategory: Record<CardCategory, number>;
  /** Mejor (menor) distancia lograda en cartas de LUGAR. */
  bestDistanceKm: number | null;
}

export interface GamePlayer extends PlayerSetup {
  id: string;
  score: number;
  stats: PlayerStats;
}

export interface TurnRecord {
  round: number;
  playerId: string;
  category: CardCategory;
  cardId: string;
  difficulty?: Difficulty;
  /** Puntos efectivamente aplicados (tras el piso de 0). */
  delta: number;
  /** null en eventos de viajero (no hay pregunta). */
  correct: boolean | null;
  distanceKm?: number;
  timedOut?: boolean;
  at: string;
}

export type GameStatus = 'PLAYING' | 'FINISHED';

export interface GameState {
  id: string;
  createdAt: string;
  config: VictoryCondition;
  players: GamePlayer[];
  currentPlayerIndex: number;
  /** Ronda actual, empieza en 1. Una ronda = un turno por jugador. */
  round: number;
  status: GameStatus;
  history: TurnRecord[];
  usedCardIds: string[];
  /** Segundos por carta elegidos en el wizard al crear la partida. */
  timerSeconds?: number;
  /**
   * El jugador en turno cayo en una casilla de transporte tras acertar una carta: en el mismo turno
   * debe jugar un Evento de Viajero antes de pasar al siguiente.
   */
  transportEvent?: boolean;
  finishedAt?: string;
  winnerIds?: string[];
}

/** Lo que el jugador hizo con la carta robada. */
export type CardOutcome =
  | { kind: 'LOCATION'; card: LocationCard; guess: LatLng }
  | { kind: 'QUIZ'; card: QuizCard; answer: string }
  | { kind: 'EVENT'; card: TravelEventCard }
  /** Se acabo el tiempo sin respuesta: cuenta como error (0 pts). */
  | { kind: 'TIMEOUT'; card: LocationCard | QuizCard };

export interface ScoreResult {
  delta: number;
  correct: boolean | null;
  distanceKm?: number;
  timedOut?: boolean;
}
