import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameState } from '@roampass/shared';
import { useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';
import { api, type PlayerStatsSummary } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { UserManagement } from './UserManagement';
import { PassportCard } from './PassportCard';
import { RecentGames } from './RecentGames';
import { GuidedTour } from '../tour/GuidedTour';
import { dashboardTour, markTourSeen, tourSeen } from '../tour/dashboardTour';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const localGame = useGameStore((s) => s.game);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const clearGame = useGameStore((s) => s.clear);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { num } = useLabels();
  const [stats, setStats] = useState<PlayerStatsSummary | null>(null);
  const [remoteGame, setRemoteGame] = useState<GameState | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  // La primera vez que el usuario entra al panel (en este dispositivo) el recorrido se abre solo,
  // cuando ya se acomodaron las animaciones de entrada.
  useEffect(() => {
    if (!user || tourSeen(user.id)) return;
    const t = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeTour = useCallback(() => {
    setTourOpen(false);
    if (user) markTourSeen(user.id);
  }, [user]);

  const loadStats = () =>
    api
      .getMyStats()
      .then(setStats)
      .catch(() => setStats({ gamesPlayed: 0, gamesWon: 0, bestScore: 0 }));

  useEffect(() => {
    void loadStats();
    api.getActiveGame().then(setRemoteGame).catch(() => setRemoteGame(null));
  }, []);

  const inProgress = localGame?.status === 'PLAYING' ? localGame : remoteGame;

  async function continueGame() {
    if (!inProgress) return;
    if (inProgress !== localGame) await resumeGame(inProgress);
    navigate('/play');
  }

  const metrics = [
    { label: t('dashboard.metrics.played'), value: stats?.gamesPlayed, icon: '🗺️' },
    { label: t('dashboard.metrics.won'), value: stats?.gamesWon, icon: '🏆' },
    { label: t('dashboard.metrics.best'), value: stats?.bestScore, icon: '⭐', suffix: t('common.milesSuffix') },
  ];

  return (
    <div className="space-y-6">
      {/* Pasaporte del viajero a la izquierda; acciones y estadisticas a la derecha */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        {user && (
          <div data-tour="passport">
            <PassportCard user={user} />
          </div>
        )}

        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <button className="btn-primary flex-1 text-lg" data-tour="new-game" onClick={() => navigate('/setup')}>
              {t('dashboard.newGame')}
            </button>
            {inProgress && (
              <button className="btn-ghost flex-1" data-tour="continue" onClick={continueGame}>
                {t('dashboard.continue', { round: inProgress.round })}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" data-tour="rules" onClick={() => navigate('/rules')}>
              {t('dashboard.howToPlay')}
            </button>
            <button className="btn-ghost shrink-0 px-4" data-tour="tour" onClick={() => setTourOpen(true)} title={t('dashboard.tourTitle')}>
              🧭 <span className="hidden sm:inline">{t('dashboard.tour')}</span>
            </button>
          </div>
          <div className="flex flex-col gap-3 md:gap-4" data-tour="stats">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                className="panel flex items-center gap-4 p-4"
                initial={{ x: 16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.08 }}
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-passport-800/5 text-2xl dark:bg-white/5">{m.icon}</span>
                <div>
                  <p className="label">{m.label}</p>
                  <p className="text-2xl font-extrabold tabular-nums md:text-3xl">
                    {m.value === undefined ? '—' : num(m.value)}
                    {m.value !== undefined && m.suffix}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div data-tour="recent">
        <RecentGames
          isAdmin={user?.role === 'ADMIN'}
          onDeleted={(id) => {
            // Si era la partida en curso, se saca el boton Continuar.
            if (localGame?.id === id) clearGame();
            if (remoteGame?.id === id) setRemoteGame(null);
            // Partidas jugadas, victorias y record se recalculan sin la partida borrada.
            void loadStats();
          }}
        />
      </div>

      {user?.role === 'ADMIN' && (
        <div data-tour="admin">
          <UserManagement />
        </div>
      )}

      {tourOpen && <GuidedTour steps={dashboardTour(t)} onClose={closeTour} />}
    </div>
  );
}
