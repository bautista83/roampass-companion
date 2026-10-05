import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../../api';
import { DEMO_ADMIN } from '../../api/localApi';
import { useAuthStore } from '../../store/authStore';
import { Brand } from '../layout/Brand';
import { ThemeToggle } from '../layout/ThemeToggle';

type Mode = 'login' | 'register';

export function Login() {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (mode === 'login' ? login : register)(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="fixed top-3 right-3">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-passport-800 p-1 shadow-2xl"
      >
        {/* Tapa de pasaporte */}
        <div className="rounded-[1.4rem] border-2 border-brass/50 bg-paper p-6 sm:p-8 dark:bg-passport-900">
          <div className="mb-6 flex justify-center">
            <Brand />
          </div>
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-passport-800/5 p-1 dark:bg-white/5" role="tablist">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`min-h-12 rounded-lg font-semibold transition ${
                  mode === m ? 'bg-white shadow dark:bg-passport-700' : 'text-passport-500 dark:text-passport-300'
                }`}
              >
                {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="username">
                Usuario
              </label>
              <input
                id="username"
                className="input"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="input"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-stamp/10 px-3 py-2 text-sm font-medium text-stamp">
                {error}
              </p>
            )}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Validando pasaporte…' : mode === 'login' ? 'Embarcar ✈️' : 'Emitir pasaporte 🛂'}
            </button>
          </form>

          {api.mode === 'local' && (
            <p className="mt-6 rounded-xl border border-dashed border-brass/60 p-3 text-center text-xs text-passport-600 dark:text-passport-200">
              <strong>Modo demo local</strong> (sin backend). Admin de prueba:{' '}
              <code className="font-mono">{DEMO_ADMIN.username}</code> /{' '}
              <code className="font-mono">{DEMO_ADMIN.password}</code>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
