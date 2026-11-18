// Idiomas de la app. Para sumar uno: agregarlo aca, crear shared/src/locales/<idioma>.ts,
// client/src/i18n/locales/<idioma>.json y los textos de los correos (server/src/mail/templates.ts).
// El contenido escrito a mano (cartas, capitales) se traduce aparte: ver CardTranslation.

export const SUPPORTED_LOCALES = ['es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

export const isLocale = (value: unknown): value is Locale => SUPPORTED_LOCALES.includes(value as Locale);

/**
 * Primer idioma soportado de la lista (perfil del usuario, navegador...). Acepta variantes
 * regionales: "es-AR" -> "es". Sin coincidencias, el idioma por defecto.
 */
export function resolveLocale(...candidates: (string | null | undefined)[]): Locale {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const value = candidate.toLowerCase();
    if (isLocale(value)) return value;
    const base = value.split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
