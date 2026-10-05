import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CARD_CATEGORIES, CATEGORY_META, PAWN_COLOR_META, rankPlayers, type GamePlayer, type GameState, formatNumber } from '@roampass/shared';
import { useGameStore } from '../../store/gameStore';

const PODIUM = [
  { place: 2, height: 'h-24 md:h-32', medal: '🥈' },
  { place: 1, height: 'h-32 md:h-44', medal: '🥇' },
  { place: 3, height: 'h-16 md:h-24', medal: '🥉' },
];

function bestCategory(p: GamePlayer) {
  const [cat, pts] = CARD_CATEGORIES.map((c) => [c, p.stats.pointsByCategory[c]] as const).sort((a, b) => b[1] - a[1])[0]!;
  return pts > 0 ? `${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}` : '—';
}

/** Pantalla "¡Victoria!": podio + resumen de estadisticas. Las tarjetas quedan bloqueadas. */
export function VictoryScreen({ game }: { game: GameState }) {
  const clear = useGameStore((s) => s.clear);
  const navigate = useNavigate();
  const ranking = rankPlayers(game.players);
  const winners = ranking.filter((r) => r.position === 1).map((r) => r.player);
  // Con empates en el podio, cada escalon muestra a quien ocupe esa posicion por orden.
  const byPlace = (place: number) => ranking.find((_, i) => i + 1 === place);
  const totalTurns = game.history.length;
  // Si la partida cerro al pasar de ronda, la ronda en curso aun no tiene turnos jugados.
  const roundsPlayed = game.history.at(-1)?.round ?? 0;

  const leave = (to: string) => {
    clear();
    navigate(to);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[950] overflow-y-auto bg-passport-950/85 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label="Victoria"
    >
      <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center gap-6 px-4 py-8 text-white">
        <motion.div initial={{ scale: 0.5, rotate: -15, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }} className="stamp border-brass text-center text-5xl text-brass md:text-7xl">
          ¡Victoria!
        </motion.div>
        <p className="text-center text-lg">
          {winners.length > 1 ? 'Empate entre ' : 'Gana '}
          <strong>{winners.map((w) => `${w.avatar} ${w.name}`).join(' y ')}</strong>
          <span className="block text-sm text-white/60">
            {roundsPlayed} {roundsPlayed === 1 ? 'ronda' : 'rondas'} · {totalTurns} cartas jugadas ·{' '}
            {game.config.mode === 'POINTS' ? `meta ${formatNumber(game.config.target)} pts` : `${game.config.target} rondas`}
          </span>
        </p>

        {/* Podio 2-1-3 */}
        <div className="grid w-full max-w-xl grid-cols-3 items-end gap-2 md:gap-4">
          {PODIUM.map(({ place, height, medal }, i) => {
            const entry = byPlace(place);
            if (!entry) return <div key={place} />;
            const hex = PAWN_COLOR_META[entry.player.color].hex;
            return (
              <motion.div key={place} className="flex flex-col items-center gap-2" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.15, type: 'spring' }}>
                <span className="grid size-14 place-items-center rounded-full text-3xl md:size-20 md:text-4xl" style={{ background: `${hex}40`, boxShadow: `0 0 0 4px ${hex}` }}>
                  {entry.player.avatar}
                </span>
                <span className="max-w-full truncate text-center text-sm font-bold md:text-base">{entry.player.name}</span>
                <span className="font-stamp text-sm tabular-nums text-brass">{formatNumber(entry.player.score)}</span>
                <div className={`flex w-full items-start justify-center rounded-t-xl pt-2 text-3xl ${height}`} style={{ background: `linear-gradient(to bottom, ${hex}, ${hex}66)` }}>
                  {entry.position === 1 ? '🥇' : medal}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Resumen de estadisticas */}
        <div className="w-full overflow-x-auto rounded-2xl bg-white/5 ring-1 ring-white/10">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs tracking-wider text-white/60 uppercase">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Viajero</th>
                <th className="p-3 text-right">Puntos</th>
                <th className="p-3 text-right">Aciertos</th>
                <th className="p-3 text-right">Mejor distancia</th>
                <th className="p-3">Fuerte en</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ position, player }) => {
                const answered = player.stats.correct + player.stats.wrong;
                return (
                  <tr key={player.id} className="border-t border-white/10">
                    <td className="p-3 font-stamp">{position}</td>
                    <td className="p-3 font-semibold">
                      {player.avatar} {player.name}
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums">{formatNumber(player.score)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {player.stats.correct}/{answered}
                      {answered > 0 && <span className="text-white/50"> ({Math.round((player.stats.correct / answered) * 100)}%)</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {player.stats.bestDistanceKm === null ? '—' : `${formatNumber(Math.round(player.stats.bestDistanceKm))} km`}
                    </td>
                    <td className="p-3">{bestCategory(player)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button className="btn bg-brass text-passport-950 hover:bg-brass/90" onClick={() => leave('/setup')}>
            🔁 Nueva partida
          </button>
          <button className="btn border border-white/25 hover:bg-white/10" onClick={() => leave('/')}>
            Ir al Dashboard
          </button>
        </div>
      </div>
    </motion.div>
  );
}
