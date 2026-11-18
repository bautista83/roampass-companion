import type { CardCategory, Difficulty, PawnColor } from '../types';

/** Valores ya calculados que usan los textos de las reglas (todos salen de las constantes del motor). */
export interface RulesParams {
  /** Formatea millas: "4.000 mi". */
  mi: (miles: number) => string;
  /** Formatea un numero con el separador del idioma. */
  num: (n: number) => string;
  /** "a, b y c" / "a, b o c". */
  list: (items: readonly (string | number)[], joiner: 'and' | 'or') => string;
  start: string;
  milesPerSpace: number;
  boardSpaces: number;
  worldTourMiles: number;
  /** Metas en millas con su nombre: [{ miles, label }]. */
  pointTargets: { miles: number; label: string }[];
  roundTargets: readonly number[];
  timerOptions: readonly number[];
  defaultTimer: number;
  minPlayers: number;
  maxPlayers: number;
  difficulties: { label: string; bonus: number }[];
  locationLabel: string;
  travelEventLabel: string;
  lastBracketKm: number;
  eventFace: number;
  minScore: number;
}

export interface RulesSectionTexts {
  title: string;
  summary: string;
  points: string[];
}

/** Textos compartidos por cliente, PDF de reglas y generador de cartas, para un idioma. */
export interface SharedTexts {
  /** Codigo para Intl (numeros y fechas). */
  intl: string;
  list: { and: string; or: string };
  categories: Record<CardCategory, { label: string; hint: string }>;
  difficulties: Record<Difficulty, { label: string }>;
  pawnColors: Record<PawnColor, string>;
  /** Unidad de las millas ("mi"). */
  milesUnit: string;
  pointTarget: { full: string; half: string; other: string };
  /** Preguntas de las cartas de banderas y capitales que se generan desde countries.json. */
  countryCards: {
    flagPrompt: string;
    capitalOfCountry: (country: string) => string;
    countryOfCapital: (capital: string) => string;
    decoyOne: (city: string) => string;
    decoyMany: (cities: string[]) => string;
  };
  rules: (p: RulesParams) => {
    physicalBoard: string[];
    sections: Record<'goal' | 'setup' | 'turn' | 'cards' | 'travel' | 'win', RulesSectionTexts>;
  };
}
