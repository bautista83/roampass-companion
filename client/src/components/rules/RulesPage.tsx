import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RulesGuide } from './RulesGuide';

/** Pantalla "Cómo jugar" (se abre desde el panel). */
export function RulesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl">{t('rules.page.title')}</h1>
        <button className="btn-ghost min-h-12 px-4 text-sm" onClick={() => navigate('/')}>
          {t('rules.page.back')}
        </button>
      </div>
      <div className="panel p-4 md:p-6">
        <RulesGuide onFinish={() => navigate('/')} />
      </div>
    </div>
  );
}
