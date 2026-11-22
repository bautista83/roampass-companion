import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Brand } from '../layout/Brand';

interface Section {
  title: string;
  items: string[];
}

/** Correo de contacto para pedidos sobre datos personales (publico, va en el bundle). */
const CONTACT_EMAIL: string | undefined = import.meta.env.VITE_CONTACT_EMAIL || undefined;

/**
 * Politica de privacidad (docs/specs/mobile-app.md, E2). Publica: la piden Google Play y App Store
 * con una URL (https://playroamle.com/privacy) y tambien se abre desde el login y el perfil.
 */
export function PrivacyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sections = t('legal.privacy.sections', { returnObjects: true }) as Section[];
  const back = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate('/'));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Brand />
        <button className="btn-ghost" onClick={back}>
          {t('legal.privacy.back')}
        </button>
      </div>
      <article className="panel space-y-6 p-5 md:p-8">
        <header className="space-y-2">
          <h1 className="text-3xl">{t('legal.privacy.title')}</h1>
          <p className="text-sm text-passport-500 dark:text-passport-300">{t('legal.privacy.updated')}</p>
          <p>{t('legal.privacy.intro')}</p>
        </header>
        {sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="text-xl">{s.title}</h2>
            <ul className="list-disc space-y-1 pl-5">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        {CONTACT_EMAIL && (
          <p className="rounded-xl border-2 border-ink bg-sun/40 px-4 py-3 font-semibold">
            <Trans
              i18nKey="legal.privacy.contact"
              values={{ email: CONTACT_EMAIL }}
              components={{ a: <a href={`mailto:${CONTACT_EMAIL}`} className="underline" /> }}
            />
          </p>
        )}
      </article>
    </div>
  );
}
