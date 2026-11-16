// Tablero de la vuelta al mundo: casillas, dado y reglas de las casillas de transporte.
// Los datos (posiciones y camino) los genera art/worldmap/build_board_v3.py en data/board.json.

import board from '../data/board.json';
import { MILES_PER_SPACE } from './scoring';
import type { CardCategory } from './types';

export type BoardSpaceType = 'monument' | 'transport';

export interface BoardSpace {
  id: string;
  type: BoardSpaceType;
  name: string;
  /** Posicion en el viewBox del mapa (board.width x board.height). */
  x: number;
  y: number;
}

export interface BoardData {
  width: number;
  height: number;
  milesPerSpace: number;
  /** Tramo que cruza el Pacifico por el borde: sus x van de 0 a width + wrapSpan. */
  wrapLeg: number;
  wrapSpan: number;
  spaces: BoardSpace[];
  /** legs[i]: camino de la casilla i a la i+1 (la ultima vuelve a la salida). */
  legs: [number, number][][];
}

export const BOARD = board as BoardData;
export const BOARD_SPACES = BOARD.spaces.length;

/** Vueltas completas y casilla actual (0 = salida en Buenos Aires) segun las millas. */
export function boardPosition(miles: number): { lap: number; space: number } {
  const steps = Math.floor(Math.max(0, miles) / MILES_PER_SPACE);
  return { lap: Math.floor(steps / BOARD_SPACES), space: steps % BOARD_SPACES };
}

export const isTransportSpace = (space: number) => BOARD.spaces[space]?.type === 'transport';

/** Cara del dado (1..6) -> categoria de carta. */
export const DIE_FACES: readonly CardCategory[] = ['LOCATION', 'FLAG', 'CITY', 'HISTORY', 'PERSONALITY', 'TRAVEL_EVENT'];

export const dieFaceOf = (category: CardCategory) => DIE_FACES.indexOf(category) + 1;

/** Tira el dado; vuelve a tirar solo si sale una categoria sin cartas. null si no queda ninguna. */
export function rollDie(
  available: (category: CardCategory) => boolean,
  random: () => number = Math.random,
): { face: number; category: CardCategory; rerolls: number[] } | null {
  if (!DIE_FACES.some(available)) return null;
  const rerolls: number[] = [];
  for (;;) {
    const face = 1 + Math.floor(random() * DIE_FACES.length);
    const category = DIE_FACES[face - 1]!;
    if (available(category)) return { face, category, rerolls };
    rerolls.push(face);
  }
}
