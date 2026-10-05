import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { api } from '../../api';
import { ThemeToggle } from './ThemeToggle';
import { Brand } from './Brand';

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearGame = useGameStore((s) => s.clear);
  const navigate = useNavigate();

  const onLogout = () => {
    // La partida queda guardada en el backend (o en la base demo) y se puede reanudar al volver.
    clearGame();
    logout();
    navigate('/login');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-3 pb-6 sm:px-4 md:px-6">
      <header className="flex items-center justify-between gap-3 py-3">
        <Link to="/" aria-label="Ir al inicio">
          <Brand compact />
        </Link>
        <div className="flex items-center gap-2">
          {api.mode === 'local' && (
            <span className="hidden rounded-full bg-brass/15 px-3 py-1 text-xs font-semibold text-brass sm:inline">
              Modo demo local
            </span>
          )}
          <span className="hidden text-sm text-passport-500 md:inline dark:text-passport-300">
            @{user?.username}
            {user?.role === 'ADMIN' && ' · Admin'}
          </span>
          <ThemeToggle />
          <button className="btn-ghost min-h-12 px-3 text-sm" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
