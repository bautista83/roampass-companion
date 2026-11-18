import { useNavigate } from 'react-router-dom';
import { AvatarIcon, PawnToken } from '../ui/PawnToken';
import { motion } from 'framer-motion';
import { CARD_CATEGORIES, PAWN_COLOR_META, rankPlayers, type GamePlayer, type GameState } from '@roampass/shared';
import { useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';
import { useGameStore } from '../../store/gameStore';

const PODIUM = [
  { place: 2, height: 'h-24 md:h-32', medal: '🥈' },
  { place: 1, height: 'h-32 md:h-44', medal: '🥇' },
  { place: 3, height: 'h-16 md:h-24', medal: '🥉' },
];

function bestCategory(p: GamePlayer, categories: ReturnType<typeof useLabels>['categories']) {
  const [cat, pts] = CARD_CATEGORIES.map((c) => [c, p.stats.pointsByCategory[c]] as const).sort((a, b) => b[1] - a[1])[0]!;
  return pts > 0 ? `${categories[cat].icon} ${categories[cat].label}` : '—';
}

/** Pantalla "¡Victoria!": podio + resumen de estadisticas. Las tarjetas quedan bloqueadas. */
export function VictoryScreen({
  game,
  onLeave,
  abandonedIds = [],
  subtitle,
}: {
  game: GameState;
  /** Partidas online: salir sin tocar la partida local guardada. */
  onLeave?: (to: string) => void;
  /** Jugadores que abandonaron (se marcan en el ranking). */
  abandonedIds?: string[];
  /** Motivo del final (online). */
  subtitle?: string;
}) {
  const clear = useGameStore((s) => s.clear);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { categories, num, miles } = useLabels();
  const ranking = rankPlayers(game.players);
  // El motor decide quien gano (en online, "ultimo en pie" puede ganar con menos millas).
  const winners = game.winnerIds?.length
    ? game.players.filter((p) => game.winnerIds!.includes(p.id))
    : ranking.filter((r) => r.position === 1).map((r) => r.player);
  // Con empates en el podio, cada escalon muestra a quien ocupe esa posicion por orden.
  const byPlace = (place: number) => ranking.find((_, i) => i + 1 === place);
  const totalTurns = game.history.length;
  // Si la partida cerro al pasar de ronda, la ronda en curso aun no tiene turnos jugados.
  const roundsPlayed = game.history.at(-1)?.round ?? 0;

  const leave = (to: string) => {
    if (onLeave) return onLeave(to);
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
      aria-label={t('game.victory.aria')}
    >
      <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center gap-6 px-4 py-8 text-white">
        <motion.div initial={{ scale: 0.5, rotate: -15, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }} className="stamp border-brass text-center text-5xl text-brass md:text-7xl">
          {t('game.victory.title')}
        </motion.div>
        <p className="text-center text-lg">
          {winners.length > 1 ? t('game.victory.tie') : t('game.victory.wins')}
          <strong>{winners.map((w) => w.name).join(` ${t('common.and')} `)}</strong>
          {subtitle && <span className="block text-sm text-white/80">{subtitle}</span>}
          <span className="block text-sm text-white/60">
            {t('game.victory.summary', {
              rounds: t('common.rounds', { count: roundsPlayed }),
              cards: totalTurns,
              goal:
                game.config.mode === 'POINTS'
                  ? t('game.victory.goalMiles', { miles: miles(game.config.target) })
                  : t('game.victory.goalRounds', { count: game.config.target }),
            })}
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
                <PawnToken avatar={entry.player.avatar} color={entry.player.color} className="w-12 md:w-16" />
                <span className="max-w-full truncate text-center text-sm font-bold md:text-base">{entry.player.name}</span>
                <span className="font-stamp text-sm tabular-nums text-brass">{num(entry.player.score)}</span>
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
                <th className="p-3">{t('game.victory.columns.traveler')}</th>
                <th className="p-3 text-right">{t('game.victory.columns.miles')}</th>
                <th className="p-3 text-right">{t('game.victory.columns.correct')}</th>
                <th className="p-3 text-right">{t('game.victory.columns.bestDistance')}</th>
                <th className="p-3">{t('game.victory.columns.strongIn')}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ position, player }) => {
                const answered = player.stats.correct + player.stats.wrong;
                return (
                  <tr key={player.id} className="border-t border-white/10">
                    <td className="p-3 font-stamp">{position}</td>
                    <td className="p-3 font-semibold">
                      <AvatarIcon avatar={player.avatar} className="mr-1.5 inline-block size-5 align-[-0.25em]" />
                      {player.name}
                      {abandonedIds.includes(player.id) && <span className="ml-1 text-xs text-white/60">{t('online.table.abandonedMark')}</span>}
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums">{num(player.score)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {player.stats.correct}/{answered}
                      {answered > 0 && <span className="text-white/50"> ({Math.round((player.stats.correct / answered) * 100)}%)</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {player.stats.bestDistanceKm === null ? '—' : `${num(Math.round(player.stats.bestDistanceKm))} km`}
                    </td>
                    <td className="p-3">{bestCategory(player, categories)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button className="btn bg-brass text-passport-950 hover:bg-brass/90" onClick={() => leave('/setup')}>
            {t('game.victory.newGame')}
          </button>
          <button className="btn border border-white/25 hover:bg-white/10" onClick={() => leave('/')}>
            {t('game.victory.toDashboard')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
