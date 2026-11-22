import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Brand } from '../layout/Brand';

/** Tarjeta centrada de las pantallas sin sesion (login, confirmar correo, recuperar contraseña). */
export function AuthCard({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-content-center justify-items-center gap-4 px-4 py-8">
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="panel relative w-full max-w-md overflow-hidden shadow-hard-lg"
      >
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex justify-center">
            <Brand />
          </div>
          {children}
        </div>
      </motion.div>
      <Link to="/privacy" className="text-sm font-semibold text-passport-500 underline dark:text-passport-300">
        {t('auth.privacyLink')}
      </Link>
    </div>
  );
}

/** Avisos de las pantallas de autenticacion. */
export function Notice({ kind, children }: { kind: 'ok' | 'info' | 'error'; children: ReactNode }) {
  const bg = kind === 'error' ? 'bg-coral' : kind === 'ok' ? 'bg-mint' : 'bg-sun';
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold text-ink ${bg}`}>
      {children}
    </div>
  );
}

/** Mensaje de un error (los de la API ya vienen traducidos por su codigo). */
export const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
