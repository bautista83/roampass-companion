import type { Card, CardCategory } from './types';

export type Rng = () => number;

/**
 * Roba una carta de la categoria evitando las ya usadas en la partida.
 * Si la categoria se agoto, se "rebaraja" y vuelven a estar disponibles todas.
 */
export function drawCard<C extends Card>(
  deck: readonly Card[],
  category: CardCategory,
  usedIds: readonly string[],
  rng: Rng = Math.random,
): C {
  const ofCategory = deck.filter((c) => c.category === category);
  if (ofCategory.length === 0) throw new Error(`No hay cartas de la categoria ${category}`);
  const used = new Set(usedIds);
  const fresh = ofCategory.filter((c) => !used.has(c.id));
  const pool = fresh.length > 0 ? fresh : ofCategory;
  return pool[Math.floor(rng() * pool.length)] as C;
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

export const flagUrl = (countryCode: string, width: 160 | 320 | 640 = 320) =>
  `https://flagcdn.com/w${width}/${countryCode.toLowerCase()}.png`;
