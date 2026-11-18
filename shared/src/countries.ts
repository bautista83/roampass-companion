// Genera cartas de BANDERA y CAPITALES a partir del listado local de paises (sin APIs externas).
// El nivel sale de la popularidad del pais y define que tan parecidas son las opciones:
//   Facil   → paises/capitales conocidos del mismo continente
//   Normal  → banderas "gemelas" o una ciudad trampa + resto del continente
//   Dificil → todas las trampas (Sidney para Australia) y la misma subregion
// Un pais famoso con trampas sube un nivel: Italia (Irlanda/Mexico) o Brasil (Rio/Sao Paulo) no son faciles.

import { seededRng, shuffle, type Rng } from './deck';
import { DEFAULT_LOCALE, type Locale } from './i18n';
import { countryName } from './localize';
import { sharedTexts } from './locales';
import type { Card, Country, CountryData, Difficulty, QuizCard } from './types';

/** Corte del ranking de popularidad (194 paises): ~1/3 por nivel. */
const EASY_MAX_FAME = 65;
const MEDIUM_MAX_FAME = 130;

export const difficultyOfCountry = (c: Country): Difficulty =>
  c.fame < EASY_MAX_FAME ? 'EASY' : c.fame < MEDIUM_MAX_FAME ? 'MEDIUM' : 'HARD';

const harder = (d: Difficulty): Difficulty => (d === 'EASY' ? 'MEDIUM' : 'HARD');

/** Toma 3 distractores recorriendo los grupos en orden de prioridad. */
function pickDistractors(answer: string, groups: string[][], rng: Rng): string[] {
  const picked: string[] = [];
  for (const group of groups) {
    for (const value of shuffle(group, rng)) {
      if (picked.length === 3) return picked;
      if (value !== answer && !picked.includes(value)) picked.push(value);
    }
  }
  return picked;
}

/**
 * `locale`: idioma de las preguntas. Los nombres de los paises salen de Intl (el navegador los trae
 * en cada idioma); las capitales, de `capitalTranslations` si las hay (si no, en español).
 */
export function generateCountryCards(
  data: CountryData,
  existing: readonly Card[] = [],
  locale: Locale = DEFAULT_LOCALE,
): QuizCard[] {
  const { countries, regions, similarFlags, decoyCities } = data;
  const texts = sharedTexts(locale).countryCards;
  const nameOf = (c: Country) => countryName(c.code, locale, c.name);
  const capitalOf = (c: Country) => c.capitalTranslations?.[locale] ?? c.capital;
  const continentOf = (c: Country) => regions[c.region];
  const byCode = new Map(countries.map((c) => [c.code, c]));

  // No duplicar paises que ya tienen carta escrita a mano.
  const handFlags = new Set(existing.flatMap((c) => (c.category === 'FLAG' && 'countryCode' in c && c.countryCode ? [c.countryCode] : [])));
  const handCapitals = new Set(existing.flatMap((c) => (c.category === 'CITY' && 'countryCode' in c && c.countryCode ? [c.countryCode] : [])));

  const names = (list: Country[]) => list.map(nameOf);
  const capitals = (list: Country[]) => list.flatMap((c) => {
    const capital = capitalOf(c);
    return capital ? [capital] : [];
  });
  const sameRegion = (c: Country) => countries.filter((o) => o.code !== c.code && o.region === c.region);
  const sameContinent = (c: Country) => countries.filter((o) => o.code !== c.code && continentOf(o) === continentOf(c));
  const famousNearby = (c: Country) => sameContinent(c).filter((o) => difficultyOfCountry(o) === 'EASY');
  const lookalikes = (c: Country) =>
    similarFlags.filter((g) => g.includes(c.code)).flat().flatMap((code) => (byCode.get(code) ? [byCode.get(code)!] : []));

  const cards: QuizCard[] = [];
  for (const c of countries) {
    const difficulty = difficultyOfCountry(c);
    const name = nameOf(c);
    const capital = capitalOf(c);

    if (!handFlags.has(c.code)) {
      const id = `gen-flag-${c.code}`;
      const twins = lookalikes(c).filter((o) => o.code !== c.code);
      const flagDifficulty = twins.length > 0 && difficulty !== 'HARD' ? harder(difficulty) : difficulty;
      const groups =
        flagDifficulty === 'EASY'
          ? [names(famousNearby(c)), names(sameContinent(c))]
          : flagDifficulty === 'MEDIUM'
            ? [names(twins), names(sameRegion(c)), names(sameContinent(c))]
            : [names(twins), names(sameRegion(c)), names(sameContinent(c))];
      cards.push({
        id,
        category: 'FLAG',
        difficulty: flagDifficulty,
        prompt: texts.flagPrompt,
        countryCode: c.code,
        options: [name, ...pickDistractors(name, groups, seededRng(id))],
        correctAnswer: name,
      });
    }

    if (capital && !handCapitals.has(c.code)) {
      const id = `gen-capital-${c.code}`;
      const rng = seededRng(id);
      const decoys = decoyCities[c.code] ?? [];
      const capDifficulty = decoys.length > 0 && difficulty === 'EASY' ? harder(difficulty) : difficulty;
      // En Normal/Dificil sin trampas, a veces la pregunta va al reves: "¿De que pais es capital X?"
      if (capDifficulty !== 'EASY' && decoys.length === 0 && rng() < 0.4) {
        cards.push({
          id,
          category: 'CITY',
          difficulty: capDifficulty,
          prompt: texts.countryOfCapital(capital),
          countryCode: c.code,
          options: [name, ...pickDistractors(name, [names(sameRegion(c)), names(sameContinent(c))], rng)],
          correctAnswer: name,
        });
      } else {
        const groups =
          capDifficulty === 'EASY'
            ? [capitals(famousNearby(c)), capitals(sameContinent(c))]
            : capDifficulty === 'MEDIUM'
              ? [decoys.slice(0, 1), capitals(sameRegion(c)), capitals(sameContinent(c))]
              : [decoys, capitals(sameRegion(c)), capitals(sameContinent(c))];
        cards.push({
          id,
          category: 'CITY',
          difficulty: capDifficulty,
          prompt: texts.capitalOfCountry(name),
          countryCode: c.code,
          options: [capital, ...pickDistractors(capital, groups, rng)],
          correctAnswer: capital,
          ...(decoys.length > 0 && {
            funFact: decoys.length === 1 ? texts.decoyOne(decoys[0]!) : texts.decoyMany(decoys),
          }),
        });
      }
    }
  }
  return cards;
}
