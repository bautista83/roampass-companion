import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { api, type EmailInviteInfo } from '../../api';
import { currentLocale } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { AuthCard, Notice, errorMessage } from './AuthCard';
import { TURNSTILE_SITE_KEY, Turnstile } from './Turnstile';

/** Aviso que el panel muestra al entrar por primera vez desde una invitacion a partida. */
export interface InviteWelcome {
  from: string;
  gameAvailable: boolean;
}

/**
 * /invite?token=… — registro desde el enlace de una invitacion por correo. El correo viene fijo
 * y la cuenta nace confirmada: entra directo (docs/specs/email-invitations.md, D5).
 */
export function InviteRegister() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [info, setInfo] = useState<{ kind: 'loading' } | { kind: 'ok'; invite: EmailInviteInfo } | { kind: 'error' }>({ kind: 'loading' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setInfo({ kind: 'error' });
      return;
    }
    api
      .getEmailInvite(token)
      .then((invite) => setInfo({ kind: 'ok', invite }))
      .catch(() => setInfo({ kind: 'error' }));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (info.kind !== 'ok') return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.register({
        username: username.trim(),
        email: info.invite.email,
        password,
        inviteToken: token,
        locale: currentLocale(),
        ...(captcha && { captchaToken: captcha }),
      });
      if (!('token' in result)) throw new Error(result.message);
      useAuthStore.setState({ token: result.token, user: result.user });
      const welcome: InviteWelcome | undefined =
        info.invite.kind === 'GAME' ? { from: info.invite.fromUsername, gameAvailable: Boolean(result.gameAvailable) } : undefined;
      navigate('/', { replace: true, state: welcome && { inviteWelcome: welcome } });
    } catch (err) {
      setError(errorMessage(err, t('common.unexpectedError')));
      setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  const needsCaptcha = Boolean(TURNSTILE_SITE_KEY) && api.mode === 'remote';

  return (
    <AuthCard>
      <h1 className="mb-4 text-center text-2xl">{t('invites.register.title')}</h1>
      {info.kind === 'loading' && <Notice kind="info">{t('invites.register.loading')}</Notice>}
      {info.kind === 'error' && (
        <div className="space-y-4">
          <Notice kind="error">{t('invites.register.invalid')}</Notice>
          <p className="text-sm text-passport-500 dark:text-passport-300">{t('invites.register.invalidHelp')}</p>
          <Link to="/login" className="btn-ghost w-full">
            {t('invites.register.goRegister')}
          </Link>
        </div>
      )}
      {info.kind === 'ok' && (
        <form onSubmit={onSubmit} className="space-y-4">
          <p>
            <Trans
              i18nKey={info.invite.kind === 'GAME' ? 'invites.register.fromGame' : 'invites.register.fromFriend'}
              values={{ from: info.invite.fromUsername }}
              components={{ b: <b /> }}
            />
          </p>
          {info.invite.kind === 'GAME' && !info.invite.gameAvailable && (
            <Notice kind="info">{t('invites.register.gameGone', { from: info.invite.fromUsername })}</Notice>
          )}
          <div>
            <label className="label" htmlFor="invite-email">
              {t('auth.fields.email')}
            </label>
            <input id="invite-email" type="email" className="input opacity-80" value={info.invite.email} readOnly aria-describedby="invite-email-hint" />
            <p id="invite-email-hint" className="mt-1 text-xs text-passport-500 dark:text-passport-300">
              {t('invites.register.emailFixed')}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="invite-username">
              {t('auth.fields.username')}
            </label>
            <input
              id="invite-username"
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
            <label className="label" htmlFor="invite-password">
              {t('auth.fields.password')}
            </label>
            <input
              id="invite-password"
              type="password"
              className="input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {needsCaptcha && <Turnstile onToken={setCaptcha} resetKey={captchaKey} />}
          {error && <Notice kind="error">{error}</Notice>}
          <button className="btn-primary w-full" disabled={busy || (needsCaptcha && !captcha)}>
            {busy ? t('auth.submit.busy') : t('invites.register.submit')}
          </button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-bold underline">
              {t('invites.register.haveAccount')}
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}

/** /invite/opt-out?token=… — baja de invitaciones. Pide confirmar con un boton (4.5). */
export function InviteOptOut() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { t } = useTranslation();
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' } | { kind: 'error'; text: string }>({ kind: 'idle' });

  async function confirm() {
    setState({ kind: 'busy' });
    try {
      await api.optOutInvites(token);
      setState({ kind: 'done' });
    } catch (err) {
      setState({ kind: 'error', text: errorMessage(err, t('common.unexpectedError')) });
    }
  }

  return (
    <AuthCard>
      <h1 className="mb-4 text-center text-2xl">{t('invites.optOut.title')}</h1>
      {state.kind === 'done' ? (
        <div className="space-y-4">
          <Notice kind="ok">{t('invites.optOut.done')}</Notice>
          <Link to="/login" className="btn-ghost w-full">
            {t('invites.optOut.home')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p>{t('invites.optOut.body')}</p>
          {state.kind === 'error' && <Notice kind="error">{state.text}</Notice>}
          <button className="btn-danger w-full" onClick={confirm} disabled={state.kind === 'busy' || !token}>
            {state.kind === 'busy' ? t('invites.optOut.busy') : t('invites.optOut.confirm')}
          </button>
        </div>
      )}
    </AuthCard>
  );
}
