import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { filterLocationMode, generateCountryCards, type Card, type CountryData } from '@roampass/shared';
import { prisma } from '../db';
import { env } from '../env';
import { rowToCard } from '../cardMapper';

const countriesPath = fileURLToPath(new URL('../../../shared/data/countries.json', import.meta.url));

let deck: Card[] | null = null;

/**
 * Mazo de las partidas online, igual al que arma el cliente: cartas de la BD + banderas y capitales
 * generadas. LUGAR usa Street View si hay clave de Google (si no, fotos). Se arma una vez y queda en
 * memoria (en español; las traducciones se aplican en el cliente al mostrar).
 */
export async function loadOnlineDeck(): Promise<Card[]> {
  const rows = await prisma.cardQuestion.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  const base = rows.map(rowToCard);
  const countries = JSON.parse(readFileSync(countriesPath, 'utf8')) as CountryData;
  deck = [...filterLocationMode(base, Boolean(env.googleMapsKey)), ...generateCountryCards(countries, base)];
  return deck;
}

export async function onlineDeck(): Promise<Card[]> {
  return deck ?? loadOnlineDeck();
}
