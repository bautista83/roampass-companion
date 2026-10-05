import type { CardCategory, Difficulty, PawnColor } from './types';

export const CATEGORY_META: Record<CardCategory, { label: string; icon: string; hint: string }> = {
  LOCATION: { label: 'Lugar', icon: '📍', hint: 'Ubica la foto en el mapa' },
  FLAG: { label: 'Bandera', icon: '🏁', hint: '¿De qué país es?' },
  CITY: { label: 'Capitales y Ciudades', icon: '🏙️', hint: 'Metrópolis del mundo' },
  HISTORY: { label: 'Historia Mundial', icon: '📜', hint: 'Años y eventos' },
  PERSONALITY: { label: 'Personalidades', icon: '👤', hint: '¿De dónde es?' },
  TRAVEL_EVENT: { label: 'Evento de Viajero', icon: '🛂', hint: '¡Suerte en la aduana!' },
};

export const DIFFICULTY_META: Record<Difficulty, { label: string; short: string }> = {
  EASY: { label: 'Fácil', short: '×1' },
  MEDIUM: { label: 'Normal', short: '×1,25' },
  HARD: { label: 'Difícil', short: '×1,5' },
};

export const PAWN_COLOR_META: Record<PawnColor, { label: string; hex: string }> = {
  red: { label: 'Rojo', hex: '#dc2626' },
  blue: { label: 'Azul', hex: '#2563eb' },
  green: { label: 'Verde', hex: '#16a34a' },
  yellow: { label: 'Amarillo', hex: '#eab308' },
  purple: { label: 'Morado', hex: '#9333ea' },
  orange: { label: 'Naranja', hex: '#ea580c' },
};

// En 'es' los numeros de 4 cifras no se agrupan (3000 vs 10.000); se fuerza para que el marcador sea consistente.
const numberFormat = new Intl.NumberFormat('es', { useGrouping: 'always' as unknown as boolean });
export const formatNumber = (n: number) => numberFormat.format(n);
