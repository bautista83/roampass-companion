import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameState } from '@roampass/shared';
import { formatNumber } from '@roampass/shared';
import { api, type PlayerStatsSummary } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { UserManagement } from './UserManagement';
import { PassportCard } from './PassportCard';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const localGame = useGameStore((s) => s.game);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlayerStatsSummary | null>(null);
  const [remoteGame, setRemoteGame] = useState<GameState | null>(null);

  useEffect(() => {
    api.getMyStats().then(setStats).catch(() => setStats({ gamesPlayed: 0, gamesWon: 0, bestScore: 0 }));
    api.getActiveGame().then(setRemoteGame).catch(() => setRemoteGame(null));
  }, []);

  const inProgress = localGame?.status === 'PLAYING' ? localGame : remoteGame;

  async function continueGame() {
    if (!inProgress) return;
    if (inProgress !== localGame) await resumeGame(inProgress);
    navigate('/play');
  }

  const metrics = [
    { label: 'Partidas jugadas', value: stats?.gamesPlayed, icon: '🗺️' },
    { label: 'Victorias', value: stats?.gamesWon, icon: '🏆' },
    { label: 'Récord personal', value: stats?.bestScore, icon: '⭐', suffix: ' mi' },
  ];

  return (
    <div className="space-y-6">
      {/* Pasaporte del viajero a la izquierda; acciones y estadisticas a la derecha */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        {user && <PassportCard user={user} />}

        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <button className="btn-primary flex-1 text-lg" onClick={() => navigate('/setup')}>
              ✈️ Crear Nueva Partida
            </button>
            {inProgress && (
              <button className="btn-ghost flex-1" onClick={continueGame}>
                ▶ Continuar (ronda {inProgress.round})
              </button>
            )}
          </div>
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
                  {m.value === undefined ? '—' : formatNumber(m.value)}
                  {m.value !== undefined && m.suffix}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {user?.role === 'ADMIN' && <UserManagement />}
    </div>
  );
}
