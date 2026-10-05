import { AnimatePresence, motion } from 'framer-motion';
import { PAWN_COLOR_META, type GamePlayer, type GameState, formatNumber } from '@roampass/shared';

/** Header del turno: sticky en movil, tarjeta fija en la columna izquierda en tablet. */
export function TurnBanner({ game, player, className = '' }: { game: GameState; player: GamePlayer; className?: string }) {
  const { mode, target } = game.config;
  const color = PAWN_COLOR_META[player.color].hex;
  const finished = game.status === 'FINISHED';

  return (
    <div className={`-mx-3 px-3 pt-1 pb-2 sm:-mx-4 sm:px-4 md:mx-0 md:p-0 ${className} bg-paper/90 backdrop-blur dark:bg-passport-950/90 md:bg-transparent md:backdrop-blur-none md:dark:bg-transparent`}>
      <div className="flex items-center gap-3 overflow-hidden rounded-2xl bg-passport-800 p-3 text-white shadow-lg md:p-4" style={{ boxShadow: `inset 6px 0 0 ${color}` }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={finished ? 'end' : player.id + game.round}
            className="flex min-w-0 flex-1 items-center gap-3"
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -30, opacity: 0 }}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-full text-2xl ring-4" style={{ background: `${color}33`, ['--tw-ring-color' as string]: color }}>
              {finished ? '🏁' : player.avatar}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-widest text-brass uppercase">{finished ? 'Partida terminada' : 'Turno de'}</p>
              <p className="truncate text-lg font-bold md:text-xl">{finished ? '¡Fin del viaje!' : player.name}</p>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-semibold tracking-widest text-brass uppercase">Ronda</p>
          <p className="font-stamp text-xl tabular-nums">
            {game.round}
            {mode === 'ROUNDS' && <span className="text-sm text-white/60">/{target}</span>}
          </p>
          {mode === 'POINTS' && <p className="text-[11px] text-white/60">Meta {formatNumber(target)}</p>}
        </div>
      </div>
    </div>
  );
}
