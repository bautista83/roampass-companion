// Tipos de dominio compartidos entre cliente y servidor.

export type Role = 'ADMIN' | 'PLAYER';

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

export type VictoryMode = 'POINTS' | 'ROUNDS';

export const POINT_TARGETS = [3000, 5000, 10000] as const;
export const ROUND_TARGETS = [10, 15, 20] as const;

export interface VictoryCondition {
  mode: VictoryMode;
  /** Puntos a alcanzar (modo POINTS) o rondas a jugar (modo ROUNDS). */
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

interface BaseCard {
  id: string;
  category: CardCategory;
}

export interface LocationCard extends BaseCard {
  category: 'LOCATION';
  prompt: string;
  imageUrl: string;
  location: LatLng;
  /** Nombre del lugar revelado tras responder. */
  answerLabel: string;
  credit?: ImageCredit;
}

export interface QuizCard extends BaseCard {
  category: QuizCategory;
  prompt: string;
  imageUrl?: string;
  /** Codigo ISO 3166-1 alpha-2 (solo FLAG); la imagen se resuelve via FlagCDN. */
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
  points: number;
  icon: string;
}

export type Card = LocationCard | QuizCard | TravelEventCard;

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
  /** Puntos efectivamente aplicados (tras el piso de 0). */
  delta: number;
  /** null en eventos de viajero (no hay pregunta). */
  correct: boolean | null;
  distanceKm?: number;
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
  finishedAt?: string;
  winnerIds?: string[];
}

/** Lo que el jugador hizo con la carta robada. */
export type CardOutcome =
  | { kind: 'LOCATION'; card: LocationCard; guess: LatLng }
  | { kind: 'QUIZ'; card: QuizCard; answer: string }
  | { kind: 'EVENT'; card: TravelEventCard };

export interface ScoreResult {
  delta: number;
  correct: boolean | null;
  distanceKm?: number;
}
