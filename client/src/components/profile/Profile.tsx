import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { UiTheme } from '@roampass/shared';
import { useAuthStore } from '../../store/authStore';
import { PassportCard } from '../dashboard/PassportCard';
import { PhotoSection } from './PhotoSection';
import { EmailSection } from './EmailSection';
import { LanguageSection } from './LanguageSection';

const STYLES: { theme: UiTheme; icon: string; preview: string; bg: string; text: string; ink: string }[] = [
  {
    theme: 'COMIC',
    icon: '💥',
    preview: '/board/board.svg',
    bg: '#eaf2e6',
    text: '#111111',
    ink: '#111111',
  },
  {
    theme: 'RETRO',
    icon: '🕹️',
    preview: '/board/board-retro.png',
    bg: '#24093d',
    text: '#fbe9ff',
    ink: '#ff2bd6',
  },
];


/**
 * Mi perfil: el estilo visual del juego (se guarda en el perfil y se aplica al iniciar sesión)
 * la foto del pasaporte, el correo y el cambio de contraseña.
 */
export function Profile() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const navigate = useNavigate();
  const [themeStatus, setThemeStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();
  const message = (e: unknown) => (e instanceof Error ? e.message : t('common.unexpectedError'));

  if (!user) return null;
  const selected = user.theme ?? 'COMIC';

  async function chooseTheme(theme: UiTheme) {
    if (theme === selected) return;
    setThemeStatus(null);
    try {
      await updateProfile({ theme });
      setThemeStatus({ ok: true, text: t('profile.styles.saved') });
    } catch (e) {
      setThemeStatus({ ok: false, text: message(e) });
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwStatus(null);
    if (next !== confirm) {
      setPwStatus({ ok: false, text: t('profile.password.mismatch') });
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setPwStatus({ ok: true, text: t('profile.password.updated') });
    } catch (err) {
      setPwStatus({ ok: false, text: message(err) });
    } finally {
      setBusy(false);
    }
  }

  const statusClass = (ok: boolean) =>
    `rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold text-ink ${ok ? 'bg-mint' : 'bg-coral'}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">{t('profile.title')}</h1>
        <button className="btn-ghost" onClick={() => navigate('/')}>
          {t('common.actions.back')}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-start">
        <div className="space-y-3">
          <PassportCard user={user} />
          <PhotoSection user={user} />
        </div>

        <div className="space-y-6">
          <section className="panel space-y-4 p-4 md:p-6" aria-labelledby="estilo">
            <div>
              <h2 id="estilo" className="text-xl">
                {t('profile.styles.title')}
              </h2>
              <p className="text-sm text-passport-500 dark:text-passport-300">
                {t('profile.styles.intro')}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label={t('profile.styles.title')}>
              {STYLES.map((s, i) => {
                const active = selected === s.theme;
                return (
                  <button
                    key={s.theme}
                    role="radio"
                    aria-checked={active}
                    onClick={() => chooseTheme(s.theme)}
                    className={`sticker flex flex-col items-stretch gap-2 overflow-hidden p-2 text-left transition ${
                      i === 0 ? '-rotate-1' : 'rotate-1'
                    } ${active ? 'ring-4 ring-sun ring-offset-2 ring-offset-paper' : 'opacity-75 hover:opacity-100'}`}
                    style={{ background: s.bg }}
                  >
                    <img
                      src={s.preview}
                      alt=""
                      className="aspect-[16/10] w-full border-2 object-cover"
                      style={{ borderColor: s.ink, imageRendering: s.theme === 'RETRO' ? 'pixelated' : undefined }}
                    />
                    <span className="px-1 pb-1" style={{ color: s.text }}>
                      <span className="block font-display text-lg">
                        {s.icon} {t(`profile.styles.${s.theme}.title`)} {active && '✓'}
                      </span>
                      <span className="block text-xs font-medium opacity-80">{t(`profile.styles.${s.theme}.desc`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {themeStatus && (
              <p role="status" className={statusClass(themeStatus.ok)}>
                {themeStatus.text}
              </p>
            )}
          </section>

          <EmailSection user={user} />

          <LanguageSection />

          <form className="panel space-y-4 p-4 md:p-6" onSubmit={changePassword} aria-labelledby="clave">
            <h2 id="clave" className="text-xl">
              {t('profile.password.title')}
            </h2>
            <div>
              <label className="label" htmlFor="current-password">
                {t('profile.password.current')}
              </label>
              <input
                id="current-password"
                type="password"
                className="input"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="new-password">
                  {t('profile.password.new')}
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="confirm-password">
                  {t('profile.password.repeat')}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </div>
            {pwStatus && (
              <p role="status" className={statusClass(pwStatus.ok)}>
                {pwStatus.text}
              </p>
            )}
            <button className="btn-primary w-full sm:w-auto" disabled={busy}>
              {busy ? t('common.actions.saving') : t('profile.password.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
