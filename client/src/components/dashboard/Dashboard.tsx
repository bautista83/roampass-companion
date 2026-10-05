import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { GameState } from '@roampass/shared';
import { formatNumber } from '@roampass/shared';
import { api, type PlayerStatsSummary } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { UserManagement } from './UserManagement';

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
    { label: 'Récord personal', value: stats?.bestScore, icon: '⭐', suffix: ' pts' },
  ];

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden p-5 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="label">Pasaporte de</p>
            <h1 className="text-3xl font-extrabold md:text-4xl">¡Hola, {user?.username}! 👋</h1>
            <p className="mt-1 text-passport-500 dark:text-passport-300">¿Listo para tu próximo viaje alrededor del mundo?</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {inProgress && (
              <button className="btn-ghost" onClick={continueGame}>
                ▶ Continuar partida (ronda {inProgress.round})
              </button>
            )}
            <button className="btn-primary text-lg" onClick={() => navigate('/setup')}>
              ✈️ Crear Nueva Partida
            </button>
          </div>
        </div>
        <span className="stamp pointer-events-none absolute -right-4 -bottom-4 border-stamp/30 text-5xl text-stamp/15 md:text-7xl" aria-hidden>
          Approved
        </span>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            className="panel flex items-center gap-4 p-5"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.08 }}
          >
            <span className="grid size-14 place-items-center rounded-full bg-passport-800/5 text-3xl dark:bg-white/5">{m.icon}</span>
            <div>
              <p className="label">{m.label}</p>
              <p className="text-3xl font-extrabold tabular-nums">
                {m.value === undefined ? '—' : formatNumber(m.value)}
                {m.value !== undefined && m.suffix}
              </p>
            </div>
          </motion.div>
        ))}
      </section>

      {user?.role === 'ADMIN' && <UserManagement />}
    </div>
  );
}
