import { CARD_CATEGORIES, type Card, type CardCategory } from './types';

export type Rng = () => number;

/**
 * Roba una carta de la categoria que no se haya usado en la partida.
 * Devuelve null si la categoria se agoto: dentro de una partida nunca se repiten cartas.
 */
export function drawCard<C extends Card>(
  deck: readonly Card[],
  category: CardCategory,
  usedIds: readonly string[],
  rng: Rng = Math.random,
): C | null {
  const used = new Set(usedIds);
  const pool = deck.filter((c) => c.category === category && !used.has(c.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)] as C;
}

/** Cartas aun disponibles por categoria (para mostrar "Quedan N" / "Agotada"). */
export function remainingByCategory(deck: readonly Card[], usedIds: readonly string[]): Record<CardCategory, number> {
  const used = new Set(usedIds);
  const counts = Object.fromEntries(CARD_CATEGORIES.map((c) => [c, 0])) as Record<CardCategory, number>;
  for (const card of deck) if (!used.has(card.id)) counts[card.category]++;
  return counts;
}

/** Fisher-Yates; se usa para mezclar las opciones de las preguntas. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** PRNG determinista (mulberry32) a partir de un texto: mismas opciones en todos los dispositivos. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const flagUrl = (countryCode: string, width: 160 | 320 | 640 = 320) =>
  `https://flagcdn.com/w${width}/${countryCode.toLowerCase()}.png`;
