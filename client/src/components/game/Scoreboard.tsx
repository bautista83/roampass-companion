import { motion } from 'framer-motion';
import { PawnToken } from '../ui/PawnToken';
import { BOARD, PAWN_COLOR_META, boardPosition, progressToGoal, rankPlayers, type GameState } from '@roampass/shared';
import { useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';

/** Marcador global en tiempo real, ordenado por posicion. */
export function Scoreboard({ game }: { game: GameState }) {
  const current = game.players[game.currentPlayerIndex];
  const { t } = useTranslation();
  const { num } = useLabels();
  const ranking = rankPlayers(game.players);
  const lastTurn = game.history.at(-1);

  return (
    <div className="panel p-3 md:p-4">
      <h2 className="label mb-3">{t('game.score.title')}</h2>
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
                <PawnToken avatar={player.avatar} color={player.color} className="w-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{player.name}</span>
                  {/* Casilla del tablero (sirve tambien para ubicar el peon en el tablero fisico) */}
                  <span className="block truncate text-[11px] font-semibold text-passport-500 dark:text-passport-300">
                    📍 {boardPosition(player.score).space} · {BOARD.spaces[boardPosition(player.score).space]!.name}
                  </span>
                </span>
                <div className="relative text-right">
                  <motion.span key={player.score} initial={{ scale: 1.35 }} animate={{ scale: 1 }} className="block text-xl font-extrabold tabular-nums">
                    {num(player.score)}
                    <span className="ml-1 text-xs font-semibold text-passport-400">{t('common.milesSuffix')}</span>
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
                      {num(justScored)}
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
