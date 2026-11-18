import { DEFAULT_LOCALE, type Locale } from '../i18n';
import { es } from './es';
import type { SharedTexts } from './types';

const TEXTS: Record<Locale, SharedTexts> = { es };

/** Textos compartidos de un idioma (si falta, los del idioma por defecto). */
export const sharedTexts = (locale: Locale = DEFAULT_LOCALE): SharedTexts => TEXTS[locale] ?? TEXTS[DEFAULT_LOCALE];

export type { RulesParams, RulesSectionTexts, SharedTexts } from './types';
