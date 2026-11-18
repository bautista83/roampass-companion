import { useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api, type User } from '../../api';
import { useAuthStore } from '../../store/authStore';


/**
 * Correo de la cuenta: agregarlo (cuentas viejas no lo tienen) o cambiarlo. Pide la contraseña
 * actual. El correo nuevo queda pendiente hasta abrir el enlace que le llega.
 */
export function EmailSection({ user }: { user: User }) {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();
  const message = (e: unknown) => (e instanceof Error ? e.message : t('common.unexpectedError'));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    try {
      await updateProfile({ email: email.trim(), currentPassword: password });
      setEmail('');
      setPassword('');
      setStatus({
        ok: true,
        text: api.mode === 'local' ? t('profile.email.savedDemo') : t('profile.email.sent', { email: email.trim().toLowerCase() }),
      });
    } catch (err) {
      setStatus({ ok: false, text: message(err) });
    } finally {
      setBusy(false);
    }
  }

  const statusClass = (ok: boolean) =>
    `rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold text-ink ${ok ? 'bg-mint' : 'bg-coral'}`;

  return (
    <form className="panel space-y-4 p-4 md:p-6" onSubmit={onSubmit} aria-labelledby="correo">
      <div>
        <h2 id="correo" className="text-xl">
          {t('profile.email.title')}
        </h2>
        <p className="text-sm text-passport-500 dark:text-passport-300">
          {user.email ? (
            <Trans i18nKey="profile.email.current" values={{ email: user.email }} components={{ b: <strong /> }} />
          ) : (
            t('profile.email.none')
          )}
        </p>
        {user.pendingEmail && (
          <p className="mt-1 text-sm font-bold text-brass">
            {t('profile.email.pending', { email: user.pendingEmail })}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="new-email">
            {user.email ? t('profile.email.newLabel') : t('profile.email.label')}
          </label>
          <input
            id="new-email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
          />
        </div>
        <div>
          <label className="label" htmlFor="email-password">
            {t('profile.email.password')}
          </label>
          <input
            id="email-password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      </div>
      {status && (
        <p role="status" className={statusClass(status.ok)}>
          {status.text}
        </p>
      )}
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? t('common.actions.saving') : user.email ? t('profile.email.change') : t('profile.email.add')}
      </button>
    </form>
  );
}
