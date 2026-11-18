import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LOCALES, type Locale } from '@roampass/shared';
import { errorText } from '../../i18n';
import { useLocale } from '../../i18n/useLabels';
import { useAuthStore } from '../../store/authStore';

/**
 * Idioma de la app y de los correos. Se guarda en el perfil. Mientras haya un solo idioma
 * (SUPPORTED_LOCALES) la seccion no se muestra.
 */
export function LanguageSection() {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const current = useLocale();
  const { t } = useTranslation();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  if (SUPPORTED_LOCALES.length < 2) return null;

  async function choose(locale: Locale) {
    if (locale === current) return;
    setStatus(null);
    try {
      await updateProfile({ locale });
      setStatus({ ok: true, text: t('profile.language.saved') });
    } catch (err) {
      setStatus({ ok: false, text: errorText(err) });
    }
  }

  return (
    <section className="panel space-y-4 p-4 md:p-6" aria-labelledby="idioma">
      <div>
        <h2 id="idioma" className="text-xl">
          {t('profile.language.title')}
        </h2>
        <p className="text-sm text-passport-500 dark:text-passport-300">{t('profile.language.intro')}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('profile.language.title')}>
        {SUPPORTED_LOCALES.map((locale) => (
          <button
            key={locale}
            role="radio"
            aria-checked={locale === current}
            onClick={() => choose(locale)}
            className={locale === current ? 'btn-primary' : 'btn-ghost'}
          >
            {t(`profile.language.names.${locale}`)}
          </button>
        ))}
      </div>
      {status && (
        <p role="status" className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold text-ink ${status.ok ? 'bg-mint' : 'bg-coral'}`}>
          {status.text}
        </p>
      )}
    </section>
  );
}
