import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildRules,
  categoryMeta,
  difficultyMeta,
  formatMiles,
  formatNumber,
  pawnColorMeta,
  pointTargetLabel,
  resolveLocale,
  sharedTexts,
  type Locale,
} from '@roampass/shared';

/** Idioma activo (se actualiza cuando cambia). */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return resolveLocale(i18n.language);
}

/**
 * Etiquetas compartidas (categorias, niveles, colores) y formatos (numeros, millas, fechas) en el
 * idioma activo. Salen de shared/src/locales, los mismos que usa el PDF de reglas.
 */
export function useLabels() {
  const locale = useLocale();
  return useMemo(() => {
    const intl = sharedTexts(locale).intl;
    return {
      locale,
      categories: categoryMeta(locale),
      difficulties: difficultyMeta(locale),
      pawnColors: pawnColorMeta(locale),
      num: (n: number) => formatNumber(n, locale),
      miles: (n: number) => formatMiles(n, locale),
      targetLabel: (miles: number) => pointTargetLabel(miles, locale),
      date: (iso: string, opts?: Intl.DateTimeFormatOptions) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(intl, opts);
      },
      dateTime: (iso: string, opts?: Intl.DateTimeFormatOptions) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(intl, opts);
      },
    };
  }, [locale]);
}

/** Reglas del juego en el idioma activo. */
export function useRules() {
  const locale = useLocale();
  return useMemo(() => buildRules(locale), [locale]);
}
