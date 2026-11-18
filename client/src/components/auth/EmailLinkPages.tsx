import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { AuthCard, Notice, errorMessage } from './AuthCard';

/** /verify-email?token=… — enlace del correo de registro o de cambio de correo. */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const loggedIn = useAuthStore((s) => Boolean(s.token));
  const refresh = useAuthStore((s) => s.refresh);
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ok'; changed: boolean } | { kind: 'error'; text: string }>({
    kind: 'loading',
  });
  // El enlace es de un solo uso: en desarrollo React monta dos veces el efecto.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState({ kind: 'error', text: 'Falta el código del enlace. Ábrelo de nuevo desde el correo.' });
      return;
    }
    api
      .verifyEmail(token)
      .then(({ purpose }) => {
        setState({ kind: 'ok', changed: purpose === 'CHANGE_EMAIL' });
        if (loggedIn) void refresh();
      })
      .catch((err) => setState({ kind: 'error', text: errorMessage(err) }));
  }, [token, loggedIn, refresh]);

  return (
    <AuthCard>
      <h1 className="mb-4 text-center text-2xl">Confirmar correo</h1>
      {state.kind === 'loading' && <Notice kind="info">Validando tu enlace…</Notice>}
      {state.kind === 'ok' && (
        <div className="space-y-4">
          <Notice kind="ok">
            {state.changed ? '¡Listo! Tu correo nuevo quedó confirmado.' : '¡Listo! Tu pasaporte está activo. Ya puedes iniciar sesión.'}
          </Notice>
          <Link to={loggedIn ? '/profile' : '/login'} className="btn-primary w-full">
            {loggedIn ? 'Ir a mi perfil' : 'Iniciar sesión ✈️'}
          </Link>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="space-y-4">
          <Notice kind="error">{state.text}</Notice>
          <p className="text-sm text-passport-500 dark:text-passport-300">
            Si tu cuenta todavía no está confirmada, intenta iniciar sesión: ahí puedes pedir otro correo.
          </p>
          <Link to="/login" className="btn-ghost w-full">
            Ir a iniciar sesión
          </Link>
        </div>
      )}
    </AuthCard>
  );
}

/** /forgot-password — pide el usuario o el correo y envía el enlace de recuperación. */
export function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const { message } = await api.forgotPassword(identifier.trim());
      setResult({ ok: true, text: message });
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="mb-2 text-center text-2xl">¿Olvidaste tu contraseña?</h1>
      <p className="mb-4 text-center text-sm text-passport-500 dark:text-passport-300">
        Escribe tu usuario o tu correo y te enviaremos un enlace para elegir una nueva.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="forgot-identifier">
            Usuario o correo
          </label>
          <input
            id="forgot-identifier"
            className="input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            minLength={3}
          />
        </div>
        {result && <Notice kind={result.ok ? 'ok' : 'error'}>{result.text}</Notice>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-bold underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthCard>
  );
}

/** /reset-password?token=… — elegir la contraseña nueva desde el enlace del correo. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    if (password !== confirm) {
      setResult({ ok: false, text: 'Las contraseñas no coinciden.' });
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setResult({ ok: true, text: 'Contraseña actualizada. Ya puedes iniciar sesión con la nueva.' });
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="mb-4 text-center text-2xl">Nueva contraseña</h1>
      {result?.ok ? (
        <div className="space-y-4">
          <Notice kind="ok">{result.text}</Notice>
          <Link to="/login" className="btn-primary w-full">
            Iniciar sesión ✈️
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {!token && <Notice kind="error">Falta el código del enlace. Ábrelo de nuevo desde el correo.</Notice>}
          <div>
            <label className="label" htmlFor="reset-password">
              Contraseña nueva
            </label>
            <input
              id="reset-password"
              type="password"
              className="input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="label" htmlFor="reset-confirm">
              Repítela
            </label>
            <input
              id="reset-confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {result && <Notice kind="error">{result.text}</Notice>}
          <button className="btn-primary w-full" disabled={busy || !token}>
            {busy ? 'Guardando…' : 'Guardar contraseña'}
          </button>
          <p className="text-center text-sm">
            <Link to="/forgot-password" className="font-bold underline">
              Pedir otro enlace
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
