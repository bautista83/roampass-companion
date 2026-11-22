import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n';
import { api, ApiError } from '../../api';
import { DEMO_ADMIN } from '../../api/localApi';
import { useAuthStore } from '../../store/authStore';
import { AuthCard, Notice, errorMessage } from './AuthCard';
import { TURNSTILE_SITE_KEY, Turnstile } from './Turnstile';

type Mode = 'login' | 'register';

export function Login() {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const [notice, setNotice] = useState<string | null>(() =>
    (location.state as { accountDeleted?: boolean } | null)?.accountDeleted ? t('auth.accountDeleted') : null,
  );
  /** Inicio de sesion rechazado por correo sin confirmar: se ofrece reenviarlo. */
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const fail = (err: unknown) => errorMessage(err, t('common.unexpectedError'));

  if (token) return <Navigate to="/" replace />;

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
    setUnverified(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setUnverified(false);
    setBusy(true);
    try {
      if (mode === 'register') {
        const pending = await register({
          username: username.trim(),
          email: email.trim(),
          password,
          ...(captcha && { captchaToken: captcha }),
          locale: currentLocale(),
        });
        if (pending) {
          // Cuenta creada sin confirmar: vuelve a "Iniciar sesion" con el aviso.
          setNotice(pending);
          setIdentifier(username.trim());
          setPassword('');
          setMode('login');
          return;
        }
      } else {
        await login(identifier.trim(), password);
      }
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setUnverified(true);
      setError(fail(err));
      // El token del captcha es de un solo uso: se pide otro para el siguiente intento.
      if (mode === 'register') setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const { message } = await api.resendVerification(identifier.trim());
      setUnverified(false);
      setError(null);
      setNotice(message);
    } catch (err) {
      setError(fail(err));
    } finally {
      setBusy(false);
    }
  }

  const needsCaptcha = mode === 'register' && Boolean(TURNSTILE_SITE_KEY) && api.mode === 'remote';

  return (
    <AuthCard>
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl border-3 border-ink bg-paper p-1 dark:border-black dark:bg-[#141714]" role="tablist">
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`min-h-12 rounded-xl font-bold transition ${
              mode === m ? 'border-2 border-ink bg-sun text-ink' : 'text-passport-500 dark:text-passport-300'
            }`}
          >
            {m === 'login' ? t('auth.tabs.login') : t('auth.tabs.register')}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === 'login' ? (
          <div>
            <label className="label" htmlFor="identifier">
              {t('auth.fields.identifier')}
            </label>
            <input
              id="identifier"
              className="input"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              minLength={3}
            />
          </div>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="username">
                {t('auth.fields.username')}
              </label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9_.\-]+"
                title={t('auth.fields.usernameHint')}
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                {t('auth.fields.email')}
              </label>
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
            </div>
          </>
        )}
        <div>
          <label className="label" htmlFor="password">
            {t('auth.fields.password')}
          </label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 6 : 1}
          />
        </div>

        {needsCaptcha && <Turnstile onToken={setCaptcha} resetKey={captchaKey} />}

        {notice && <Notice kind="info">{notice}</Notice>}
        {error && (
          <Notice kind="error">
            <p>{error}</p>
            {unverified && (
              <button type="button" className="mt-2 underline" onClick={resend} disabled={busy}>
                {t('auth.resendVerification')}
              </button>
            )}
          </Notice>
        )}
        <button className="btn-primary w-full" disabled={busy || (needsCaptcha && !captcha)}>
          {busy ? t('auth.submit.busy') : mode === 'login' ? t('auth.submit.login') : t('auth.submit.register')}
        </button>
      </form>

      {mode === 'login' && api.mode === 'remote' && (
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="font-bold underline">
            {t('auth.forgotLink')}
          </Link>
        </p>
      )}

      {api.mode === 'local' && (
        <p className="mt-6 rounded-xl border-2 border-dashed border-ink p-3 text-center text-xs text-passport-600 dark:border-passport-400 dark:text-passport-200">
          <strong>{t('auth.demo.title')}</strong> {t('auth.demo.body')}{' '}
          <code className="font-mono">{DEMO_ADMIN.username}</code> /{' '}
          <code className="font-mono">{DEMO_ADMIN.password}</code>
        </p>
      )}
    </AuthCard>
  );
}
