import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api, type RecentGame } from '../../api';
import { useLabels } from '../../i18n/useLabels';
import { PawnToken } from '../ui/PawnToken';

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

const TILT = ['-rotate-1', 'rotate-1', 'rotate-0', '-rotate-[0.5deg]'];

/** Grilla de las ultimas partidas con quien gano. El admin ve las de todos; cada usuario, las suyas. */
export function RecentGames({ isAdmin, onDeleted }: { isAdmin: boolean; onDeleted?: (id: string) => void }) {
  const [games, setGames] = useState<RecentGame[] | null>(null);
  const [error, setError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    api
      .getRecentGames(12)
      .then(setGames)
      .catch(() => setError(true));
  }, []);

  async function remove(id: string, online: boolean) {
    // Las partidas online se ocultan del panel propio (el admin si las elimina).
    if (online && !games?.find((g) => g.id === id)?.canDelete) await api.hideOnline(id);
    else await api.deleteGame(id);
    setGames((gs) => gs?.filter((g) => g.id !== id) ?? null);
    onDeleted?.(id);
  }

  return (
    <section className="space-y-3" aria-labelledby="ultimas-partidas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ultimas-partidas" className="text-2xl">
          {t('dashboard.recent.title')}
        </h2>
        <p className="text-sm text-passport-500 dark:text-passport-300">
          {isAdmin ? t('dashboard.recent.subtitleAdmin') : t('dashboard.recent.subtitlePlayer')}
        </p>
      </div>

      {error && <p className="panel p-4 text-sm">{t('dashboard.recent.loadError')}</p>}
      {!error && games === null && <p className="panel p-4 text-sm text-passport-500">{t('dashboard.recent.loading')}</p>}
      {games?.length === 0 && (
        <div className="panel p-6 text-center">
          <p className="text-3xl">🧳</p>
          <p className="font-bold">{t('dashboard.recent.emptyTitle')}</p>
          <p className="text-sm text-passport-500 dark:text-passport-300">{t('dashboard.recent.emptyBody')}</p>
        </div>
      )}

      {games && games.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {games.map((g, i) => (
              <motion.li
                key={g.id}
                layout
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1, transition: { delay: Math.min(i, 8) * 0.05 } }}
                exit={{ scale: 0.6, rotate: -8, opacity: 0, transition: { duration: 0.25 } }}
              >
                <GameCard game={g} isAdmin={isAdmin} tilt={TILT[i % TILT.length]!} onDelete={() => remove(g.id, !!g.online)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function GameCard(props: { game: RecentGame; isAdmin: boolean; tilt: string; onDelete: () => Promise<void> }) {
  const { game: g, isAdmin, tilt, onDelete } = props;
  const finished = g.status === 'FINISHED';
  const winners = g.players.filter((p) => p.isWinner);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { num, miles, dateTime } = useLabels();
  const goal = g.mode === 'POINTS' ? t('dashboard.recent.goalMiles', { miles: miles(g.target) }) : t('dashboard.recent.goalRounds', { count: g.target });

  const hideOnly = !!g.online && !g.canDelete;

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.recent.deleteError'));
      setBusy(false);
    }
  }

  return (
    <article className={`panel relative flex h-full flex-col overflow-hidden ${tilt}`}>
      {/* Confirmacion para eliminar: tapa la tarjeta */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="absolute inset-0 z-10 grid place-items-center bg-paper/95 p-4 text-center dark:bg-passport-950/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog"
            aria-label={t('dashboard.recent.confirmAria')}
          >
            <div className="space-y-3">
              <p className="text-3xl" aria-hidden>
                🗑️
              </p>
              <p className="font-display text-lg leading-tight">{hideOnly ? t('dashboard.recent.hideTitle') : t('dashboard.recent.confirmTitle')}</p>
              <p className="text-sm text-passport-500 dark:text-passport-300">
                {hideOnly ? (
                  g.status === 'PLAYING' ? t('dashboard.recent.hideInProgress') : t('dashboard.recent.hideBody')
                ) : (
                  <>
                    {g.status === 'PLAYING' ? t('dashboard.recent.confirmInProgress') : ''}
                    {t('dashboard.recent.confirmIrreversible')}
                  </>
                )}
              </p>
              {error && <p className="text-sm font-bold text-stamp">{error}</p>}
              <div className="flex justify-center gap-2">
                <button className="btn-ghost min-h-10 px-4" onClick={() => setConfirming(false)} disabled={busy}>
                  {t('common.actions.cancel')}
                </button>
                <button className="btn-danger min-h-10 px-4" onClick={confirmDelete} disabled={busy} autoFocus>
                  {busy ? t('common.actions.deleting') : hideOnly ? t('dashboard.recent.hide') : t('common.actions.delete')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between gap-2 border-b-3 border-ink bg-sky/40 px-4 py-2 dark:border-black dark:bg-white/5">
        <span className="text-xs font-extrabold tracking-widest uppercase">
          {g.online ? t('dashboard.recent.boardOnline') : g.board === 'DIGITAL' ? t('dashboard.recent.boardDigital') : t('dashboard.recent.boardPhysical')}
        </span>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold uppercase ${
              finished ? 'bg-mint text-ink' : 'bg-sun text-ink'
            }`}
          >
            {finished ? t('dashboard.recent.finished') : t('dashboard.recent.inProgress', { round: g.round })}
          </span>
          {(g.canDelete || g.canHide) && (
            <button
              className="grid size-7 place-items-center rounded-full border-2 border-ink bg-white text-sm font-extrabold text-ink transition hover:scale-110 hover:bg-coral dark:border-black"
              onClick={() => setConfirming(true)}
              aria-label={t('dashboard.recent.deleteGame')}
              title={t('dashboard.recent.deleteGame')}
            >
              ✕
            </button>
          )}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Ganador destacado */}
        {finished && winners.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              <PawnToken avatar={winners[0]!.avatar} color={winners[0]!.color} className="w-11" />
              <span className="absolute -top-2 -right-2 text-xl" aria-hidden>
                🏆
              </span>
            </div>
            <div className="min-w-0">
              <p className="label mb-0">{winners.length > 1 ? t('dashboard.recent.tie') : t('dashboard.recent.won')}</p>
              <p className="truncate font-display text-lg leading-tight">{winners.map((w) => w.name).join(` ${t('common.and')} `)}</p>
              <p className="text-sm font-bold tabular-nums">{miles(winners[0]!.score)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-passport-500 dark:text-passport-300">{t('dashboard.recent.stillTraveling')}</p>
        )}

        {/* Todos los jugadores */}
        <ol className="space-y-1.5">
          {g.players.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-center font-stamp text-passport-400">{i + 1}</span>
              <PawnToken avatar={p.avatar} color={p.color} className="w-6 shrink-0" />
              <span className={`min-w-0 flex-1 truncate ${p.isWinner ? 'font-extrabold' : 'font-medium'}`}>
                {p.name}
                {p.username && <span className="ml-1 text-xs text-passport-400">@{p.username}</span>}
              </span>
              <span className="font-bold tabular-nums">{num(p.score)}</span>
            </li>
          ))}
        </ol>

        <footer className="mt-auto flex flex-wrap justify-between gap-x-3 gap-y-1 border-t-2 border-dashed border-passport-200 pt-2 text-xs text-passport-500 dark:border-white/10 dark:text-passport-300">
          <span>
            📅 {dateTime(g.finishedAt ?? g.startedAt, DATE_FORMAT)} · {goal}
          </span>
          {isAdmin && <span className="font-bold">{t('dashboard.recent.createdBy', { host: g.host })}</span>}
        </footer>
      </div>
    </article>
  );
}
