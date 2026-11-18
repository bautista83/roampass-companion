import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AVATARS,
  DEFAULT_DIE_TIMEOUT_SECONDS,
  DEFAULT_TIMER_SECONDS,
  DIE_TIMEOUT_OPTIONS,
  POINT_TARGETS,
  ROUND_TARGETS,
  TIMER_OPTIONS,
  type PawnColor,
  type VictoryMode,
} from '@roampass/shared';
import { api } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { onlineAvailable } from '../../online/socket';
import { PawnPicker } from './shared';

/** /online/new — configurar y crear la sala (quien la crea es el anfitrion). */
export function OnlineSetup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { num } = useLabels();
  const [mode, setMode] = useState<VictoryMode>('POINTS');
  const [target, setTarget] = useState<number>(POINT_TARGETS[0]);
  const [timerSeconds, setTimerSeconds] = useState<number>(DEFAULT_TIMER_SECONDS);
  const [dieTimeoutSeconds, setDieTimeout] = useState<number>(DEFAULT_DIE_TIMEOUT_SECONDS);
  const [pawn, setPawn] = useState<{ color: PawnColor; avatar: string }>({ color: 'red', avatar: AVATARS[0] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!onlineAvailable) return <p className="panel p-6">{t('online.demoUnavailable')}</p>;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { sessionId } = await api.createOnlineGame({ mode, target, timerSeconds, dieTimeoutSeconds, ...pawn });
      navigate(`/online/${sessionId}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const choice = (active: boolean) =>
    `min-h-12 rounded-xl px-3 text-sm font-bold tabular-nums transition ${
      active ? 'bg-passport-700 text-white dark:bg-brass dark:text-passport-950' : 'bg-white ring-1 ring-passport-800/15 dark:bg-passport-950 dark:ring-white/15'
    }`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl">{t('online.setup.title')}</h1>
        <button className="btn-ghost" onClick={() => navigate('/')}>
          {t('common.actions.back')}
        </button>
      </div>
      <p className="text-sm text-passport-500 dark:text-passport-300">{t('online.setup.intro')}</p>

      <section className="panel space-y-4 p-4 md:p-6">
        <h2 className="text-xl">{t('online.setup.victory')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(['POINTS', 'ROUNDS'] as const).map((m) => (
            <div key={m} className={`rounded-2xl border-2 p-3 ${mode === m ? 'border-passport-600 dark:border-brass' : 'border-passport-800/10 dark:border-white/10'}`}>
              <button
                className="w-full text-left"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setTarget(m === 'POINTS' ? POINT_TARGETS[0] : ROUND_TARGETS[0]);
                }}
              >
                <span className="block text-lg font-bold">{t(`setup.victory.${m}.title`)}</span>
                <span className="text-sm text-passport-500 dark:text-passport-300">{t(`setup.victory.${m}.desc`)}</span>
              </button>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(m === 'POINTS' ? POINT_TARGETS : ROUND_TARGETS).map((v) => (
                  <button key={v} disabled={mode !== m} className={`${choice(mode === m && target === v)} disabled:opacity-40`} onClick={() => setTarget(v)}>
                    {num(v)}
                    <span className="block text-[10px] font-medium opacity-70">{t(`setup.victory.${m}.unit`)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="font-bold">{t('online.setup.cardTimer')}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('online.setup.cardTimer')}>
            {TIMER_OPTIONS.map((v) => (
              <button key={v} role="radio" aria-checked={timerSeconds === v} className={choice(timerSeconds === v)} onClick={() => setTimerSeconds(v)}>
                {v} s
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="font-bold">{t('online.setup.dieTimer')}</p>
          <p className="text-xs text-passport-500 dark:text-passport-300">{t('online.setup.dieTimerDesc')}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('online.setup.dieTimer')}>
            {DIE_TIMEOUT_OPTIONS.map((v) => (
              <button key={v} role="radio" aria-checked={dieTimeoutSeconds === v} className={choice(dieTimeoutSeconds === v)} onClick={() => setDieTimeout(v)}>
                {v} s
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel space-y-3 p-4 md:p-6">
        <h2 className="text-xl">{t('online.setup.yourPawn')}</h2>
        <PawnPicker color={pawn.color} avatar={pawn.avatar} onChange={setPawn} />
      </section>

      {error && (
        <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
      <button className="btn-primary w-full text-lg" onClick={create} disabled={busy}>
        {busy ? t('online.setup.creating') : t('online.setup.create')}
      </button>
    </div>
  );
}
