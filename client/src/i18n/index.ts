// Traducciones de la interfaz (i18next). Cada idioma tiene una carpeta en ./locales con un JSON por
// area. Para sumar un idioma: copiar locales/es, traducirla, registrarla en RESOURCES y agregar el
// codigo en shared/src/i18n.ts (SUPPORTED_LOCALES).

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveLocale, type Locale } from '@roampass/shared';
import { es } from './locales/es/index';

export const RESOURCES = { es } satisfies Record<Locale, typeof es>;

/** Idioma guardado en el perfil (lo escribe el authStore) o el del navegador. */
function initialLocale(): Locale {
  let stored: string | undefined;
  try {
    stored = JSON.parse(localStorage.getItem('roampass-auth') ?? '{}').state?.user?.locale;
  } catch {
    // localStorage bloqueado o corrupto: se usa el idioma del navegador
  }
  return resolveLocale(stored, ...(typeof navigator === 'undefined' ? [] : navigator.languages));
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(RESOURCES).map(([lng, t]) => [lng, { translation: t }])),
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: { escapeValue: false }, // React ya escapa
  returnNull: false,
});

const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

/** Idioma activo de la interfaz. */
export const currentLocale = (): Locale => resolveLocale(i18n.language);

/** Cambia el idioma (si no esta soportado, queda el por defecto). */
export function setLocale(locale: string | null | undefined) {
  const next = resolveLocale(locale, ...(typeof navigator === 'undefined' ? [] : navigator.languages));
  if (next !== i18n.language) void i18n.changeLanguage(next);
}

/**
 * Mensaje de error para mostrar: la traduccion del codigo del servidor (errors.<CODE>) o, si no
 * esta traducido, el mensaje que mando el servidor.
 */
export function translateError(code: string | undefined, fallback: string, params?: Record<string, unknown>): string {
  const key = `errors.${code}`;
  return code && i18n.exists(key) ? String(i18n.t(key as 'errors.INTERNAL', params)) : fallback;
}

/** Mensaje de cualquier error: GameRuleError (motor) y ApiError ya traen su codigo. */
export function errorText(err: unknown): string {
  if (err instanceof Error) {
    const { code, params } = err as Error & { code?: string; params?: Record<string, unknown> };
    return translateError(code, err.message, params);
  }
  return i18n.t('common.unexpectedError');
}

export default i18n;
