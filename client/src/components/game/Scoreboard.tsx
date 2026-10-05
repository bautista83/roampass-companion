import { motion } from 'framer-motion';
import { PAWN_COLOR_META, progressToGoal, rankPlayers, type GameState, formatNumber } from '@roampass/shared';

/** Marcador global en tiempo real, ordenado por posicion. */
export function Scoreboard({ game }: { game: GameState }) {
  const current = game.players[game.currentPlayerIndex];
  const ranking = rankPlayers(game.players);
  const lastTurn = game.history.at(-1);

  return (
    <div className="panel p-3 md:p-4">
      <h2 className="label mb-3">Marcador</h2>
      <motion.ol layout className="space-y-2">
        {ranking.map(({ position, player }) => {
          const hex = PAWN_COLOR_META[player.color].hex;
          const isTurn = game.status === 'PLAYING' && player.id === current?.id;
          const justScored = lastTurn?.playerId === player.id ? lastTurn.delta : null;
          return (
            <motion.li
              layout
              key={player.id}
              className={`relative rounded-xl p-3 transition ${isTurn ? 'bg-passport-50 ring-2 ring-passport-600 dark:bg-brass/10 dark:ring-brass' : 'bg-passport-800/[0.03] dark:bg-white/[0.03]'}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center font-stamp text-passport-400">{position}</span>
                <span className="grid size-10 shrink-0 place-items-center rounded-full text-xl" style={{ background: `${hex}26`, boxShadow: `0 0 0 3px ${hex}` }}>
                  {player.avatar}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
                <div className="relative text-right">
                  <motion.span key={player.score} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="block text-xl font-extrabold tabular-nums">
                    {formatNumber(player.score)}
                  </motion.span>
                  {justScored !== null && justScored !== 0 && (
                    <motion.span
                      key={game.history.length}
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -18 }}
                      transition={{ duration: 1.6 }}
                      className={`absolute -top-3 right-0 text-xs font-bold ${justScored > 0 ? 'text-stamp-green' : 'text-stamp'}`}
                    >
                      {justScored > 0 ? '+' : ''}
                      {justScored}
                    </motion.span>
                  )}
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-passport-800/10 dark:bg-white/10">
                <motion.div className="h-full rounded-full" style={{ background: hex }} initial={{ width: 0 }} animate={{ width: `${progressToGoal(game, player) * 100}%` }} />
              </div>
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
}
