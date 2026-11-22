import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { ApiError, type User } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../ui/Modal';

/**
 * Eliminar mi cuenta (docs/specs/mobile-app.md, 4.6). Se confirma escribiendo el nombre de usuario
 * y la contraseña. Lo exigen Google Play y App Store.
 */
export function DeleteAccountSection({ user }: { user: User }) {
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setUsername('');
    setPassword('');
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(password);
      navigate('/login', { replace: true, state: { accountDeleted: true } });
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'ALREADY_IN_ONLINE_GAME'
          ? t('profile.deleteAccount.inOnlineGame')
          : err instanceof ApiError && err.code === 'WRONG_PASSWORD'
            ? t('profile.deleteAccount.wrongPassword')
            : err instanceof Error
            ? err.message
            : t('common.unexpectedError'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-3 border-stamp p-4 md:p-6" aria-labelledby="eliminar-cuenta">
      <h2 id="eliminar-cuenta" className="text-xl">
        {t('profile.deleteAccount.title')}
      </h2>
      <p className="text-sm text-passport-500 dark:text-passport-300">
        {t('profile.deleteAccount.intro')}{' '}
        <Link to="/privacy" className="font-bold underline">
          {t('profile.deleteAccount.privacyLink')}
        </Link>
      </p>
      <button type="button" className="btn-danger w-full sm:w-auto" onClick={() => setOpen(true)}>
        {t('profile.deleteAccount.button')}
      </button>

      <Modal open={open} onClose={busy ? undefined : close} title={t('profile.deleteAccount.confirmTitle')}>
        <form className="space-y-4 p-6" onSubmit={submit}>
          <p>
            <Trans i18nKey="profile.deleteAccount.confirmBody" values={{ name: user.username }} components={{ b: <strong /> }} />
          </p>
          <div>
            <label className="label" htmlFor="delete-username">
              {t('profile.deleteAccount.typeUsername')}
            </label>
            <input
              id="delete-username"
              className="input"
              autoComplete="off"
              autoCapitalize="none"
              placeholder={user.username}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="delete-password">
              {t('profile.deleteAccount.password')}
            </label>
            <input
              id="delete-password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-bold text-ink">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={close} disabled={busy}>
              {t('common.actions.cancel')}
            </button>
            <button className="btn-danger" disabled={busy || username.trim() !== user.username || !password}>
              {busy ? t('profile.deleteAccount.deleting') : t('profile.deleteAccount.submit')}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
