import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { api } from '../../api';
import { Brand } from './Brand';
import { InviteNotifier } from '../online/InviteNotifier';

export function AppShell({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearGame = useGameStore((s) => s.clear);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const onLogout = () => {
    // La partida queda guardada en el backend (o en la base demo) y se puede reanudar al volver.
    clearGame();
    logout();
    navigate('/login');
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-3 pb-6 sm:px-4 md:px-6">
      <header className="flex items-center justify-between gap-3 py-3">
        <Link to="/" aria-label={t('dashboard.shell.home')}>
          <Brand compact />
        </Link>
        <div className="flex items-center gap-2">
          {api.mode === 'local' && (
            <span className="hidden rounded-full border-2 border-ink bg-sun px-3 py-1 text-xs font-bold text-ink sm:inline">
              {t('dashboard.shell.demoBadge')}
            </span>
          )}
          <Link to="/profile" className="btn-ghost min-h-12 px-3 text-sm" title={t('dashboard.shell.profileTitle')} data-tour="profile">
            👤 <span className="hidden md:inline">@{user?.username}{user?.role === 'ADMIN' && t('dashboard.shell.adminSuffix')}</span>
            <span className="md:hidden">{t('dashboard.shell.profileShort')}</span>
          </Link>
          <button className="btn-ghost min-h-12 px-3 text-sm" onClick={onLogout}>
            {t('dashboard.shell.logout')}
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {api.mode === 'remote' && <InviteNotifier />}
    </div>
  );
}
