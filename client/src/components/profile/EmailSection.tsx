import { useState, type FormEvent } from 'react';
import { api, type User } from '../../api';
import { useAuthStore } from '../../store/authStore';

const message = (e: unknown) => (e instanceof Error ? e.message : 'Error inesperado');

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
        text:
          api.mode === 'local'
            ? 'Correo guardado ✓'
            : `Te enviamos un enlace a ${email.trim().toLowerCase()}. Ábrelo para confirmar el cambio.`,
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
          Correo
        </h2>
        <p className="text-sm text-passport-500 dark:text-passport-300">
          {user.email ? (
            <>
              Tu correo es <strong>{user.email}</strong>.
            </>
          ) : (
            'Todavía no tienes un correo. Agrégalo para poder recuperar tu contraseña.'
          )}
        </p>
        {user.pendingEmail && (
          <p className="mt-1 text-sm font-bold text-brass">
            ⏳ Pendiente de confirmar: {user.pendingEmail}. Abre el enlace que te enviamos.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="new-email">
            {user.email ? 'Correo nuevo' : 'Correo'}
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
            Contraseña actual
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
        {busy ? 'Guardando…' : user.email ? 'Cambiar correo' : 'Agregar correo'}
      </button>
    </form>
  );
}
