import { AnimatePresence, motion } from 'framer-motion';
import { PawnToken } from '../ui/PawnToken';
import { PAWN_COLOR_META, timerSecondsOf, type GamePlayer, type GameState } from '@roampass/shared';
import { useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';

/** Header del turno: sticky en movil, tarjeta fija en la columna izquierda en tablet. */
export function TurnBanner({ game, player, className = '' }: { game: GameState; player: GamePlayer; className?: string }) {
  const { mode, target } = game.config;
  const { t } = useTranslation();
  const { miles } = useLabels();
  const color = PAWN_COLOR_META[player.color].hex;
  const finished = game.status === 'FINISHED';

  return (
    <div className={`-mx-3 px-3 pt-1 pb-2 sm:-mx-4 sm:px-4 md:mx-0 md:p-0 ${className} bg-paper/90 backdrop-blur dark:bg-passport-950/90 md:bg-transparent md:backdrop-blur-none md:dark:bg-transparent`}>
      <div className="sticker flex items-center gap-3 overflow-hidden bg-sun p-3 text-ink md:p-4" style={{ borderLeft: `10px solid ${color}` }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={finished ? 'end' : player.id + game.round}
            className="flex min-w-0 flex-1 items-center gap-3"
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -30, opacity: 0 }}
          >
            {finished ? (
              <span className="grid size-12 shrink-0 place-items-center rounded-full border-3 border-ink bg-white text-2xl">🏁</span>
            ) : (
              <PawnToken avatar={player.avatar} color={player.color} className="w-10 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-widest text-ink/60 uppercase">{finished ? t('game.turn.finished') : t('game.turn.turnOf')}</p>
              <p className="truncate font-display text-lg md:text-xl">{finished ? t('game.turn.endOfTrip') : player.name}</p>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-extrabold tracking-widest text-ink/60 uppercase">{t('game.turn.round')}</p>
          <p className="font-stamp text-xl tabular-nums">
            {game.round}
            {mode === 'ROUNDS' && <span className="text-sm text-ink/60">/{target}</span>}
          </p>
          {mode === 'POINTS' && <p className="text-[11px] font-semibold text-ink/70">{t('game.turn.goal', { miles: miles(target) })}</p>}
          <p className="text-[11px] font-semibold text-ink/70">{t('game.turn.perCard', { seconds: timerSecondsOf(game) })}</p>
        </div>
      </div>
    </div>
  );
}
