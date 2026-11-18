import { DEFAULT_LOCALE, type Locale } from './i18n';
import type { Card } from './types';

// Funcion (y no `locale === DEFAULT_LOCALE`) para que TypeScript no "angoste" el tipo a never
// mientras haya un solo idioma.
const isDefaultLocale = (locale: Locale): boolean => locale === DEFAULT_LOCALE;

/**
 * Devuelve la carta con los textos del idioma pedido. Lo que no esta traducido queda en el idioma
 * por defecto. Las opciones se reemplazan solo si la traduccion tiene la misma cantidad, y la
 * respuesta correcta se traduce por posicion, asi el puntaje sigue funcionando.
 */
export function localizeCard<C extends Card>(card: C, locale: Locale): C {
  if (isDefaultLocale(locale)) return card;
  const tr = card.translations?.[locale];
  if (!tr) return card;

  switch (card.category) {
    case 'LOCATION':
      return { ...card, ...(tr.prompt && { prompt: tr.prompt }), ...(tr.answerLabel && { answerLabel: tr.answerLabel }) };
    case 'TRAVEL_EVENT':
      return { ...card, ...(tr.title && { title: tr.title }), ...(tr.description && { description: tr.description }) };
    default: {
      const quiz = card as Extract<Card, { options: string[] }>;
      const sameShape = tr.options && tr.options.length === quiz.options.length;
      const answerIndex = quiz.options.indexOf(quiz.correctAnswer);
      return {
        ...card,
        ...(tr.prompt && { prompt: tr.prompt }),
        ...(tr.funFact && { funFact: tr.funFact }),
        ...(sameShape && answerIndex >= 0 && { options: tr.options, correctAnswer: tr.options![answerIndex] }),
      };
    }
  }
}

/** Nombre de un pais en un idioma a partir de su codigo ISO (lo trae el navegador / Node). */
export function countryName(code: string, locale: Locale, fallback: string): string {
  if (isDefaultLocale(locale)) return fallback;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? fallback;
  } catch {
    return fallback;
  }
}
