import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatNumber } from '@roampass/shared';
import { api, type RecentGame } from '../../api';
import { PawnToken } from '../ui/PawnToken';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const goalOf = (g: RecentGame) => (g.mode === 'POINTS' ? `Meta ${formatNumber(g.target)} mi` : `${g.target} rondas`);

const TILT = ['-rotate-1', 'rotate-1', 'rotate-0', '-rotate-[0.5deg]'];

/** Grilla de las ultimas partidas con quien gano. El admin ve las de todos; cada usuario, las suyas. */
export function RecentGames({ isAdmin, onDeleted }: { isAdmin: boolean; onDeleted?: (id: string) => void }) {
  const [games, setGames] = useState<RecentGame[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getRecentGames(12)
      .then(setGames)
      .catch(() => setError(true));
  }, []);

  async function remove(id: string) {
    await api.deleteGame(id);
    setGames((gs) => gs?.filter((g) => g.id !== id) ?? null);
    onDeleted?.(id);
  }

  return (
    <section className="space-y-3" aria-labelledby="ultimas-partidas">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ultimas-partidas" className="text-2xl">
          🗺️ Últimas partidas
        </h2>
        <p className="text-sm text-passport-500 dark:text-passport-300">
          {isAdmin ? 'Todas las partidas de todos los viajeros' : 'Las partidas que creaste o jugaste'}
        </p>
      </div>

      {error && <p className="panel p-4 text-sm">No se pudieron cargar las partidas.</p>}
      {!error && games === null && <p className="panel p-4 text-sm text-passport-500">Cargando partidas…</p>}
      {games?.length === 0 && (
        <div className="panel p-6 text-center">
          <p className="text-3xl">🧳</p>
          <p className="font-bold">Todavía no hay partidas.</p>
          <p className="text-sm text-passport-500 dark:text-passport-300">Cuando terminen su primer viaje, acá van a ver quién ganó.</p>
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
                <GameCard game={g} isAdmin={isAdmin} tilt={TILT[i % TILT.length]!} onDelete={() => remove(g.id)} />
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

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
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
            aria-label="Confirmar eliminación"
          >
            <div className="space-y-3">
              <p className="text-3xl" aria-hidden>
                🗑️
              </p>
              <p className="font-display text-lg leading-tight">¿Eliminar esta partida?</p>
              <p className="text-sm text-passport-500 dark:text-passport-300">
                {g.status === 'PLAYING' ? 'Está en curso: no se va a poder continuar. ' : ''}No se puede deshacer.
              </p>
              {error && <p className="text-sm font-bold text-stamp">{error}</p>}
              <div className="flex justify-center gap-2">
                <button className="btn-ghost min-h-10 px-4" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancelar
                </button>
                <button className="btn-danger min-h-10 px-4" onClick={confirmDelete} disabled={busy} autoFocus>
                  {busy ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between gap-2 border-b-3 border-ink bg-sky/40 px-4 py-2 dark:border-black dark:bg-white/5">
        <span className="text-xs font-extrabold tracking-widest uppercase">
          {g.board === 'DIGITAL' ? '🎲 Tablero digital' : '🧩 Tablero físico'}
        </span>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold uppercase ${
              finished ? 'bg-mint text-ink' : 'bg-sun text-ink'
            }`}
          >
            {finished ? 'Terminada' : `En curso · ronda ${g.round}`}
          </span>
          {g.canDelete && (
            <button
              className="grid size-7 place-items-center rounded-full border-2 border-ink bg-white text-sm font-extrabold text-ink transition hover:scale-110 hover:bg-coral dark:border-black"
              onClick={() => setConfirming(true)}
              aria-label="Eliminar partida"
              title="Eliminar partida"
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
              <p className="label mb-0">{winners.length > 1 ? 'Empate' : 'Ganó'}</p>
              <p className="truncate font-display text-lg leading-tight">{winners.map((w) => w.name).join(' y ')}</p>
              <p className="text-sm font-bold tabular-nums">{formatNumber(winners[0]!.score)} mi</p>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-passport-500 dark:text-passport-300">⏳ Todavía viajando…</p>
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
              <span className="font-bold tabular-nums">{formatNumber(p.score)}</span>
            </li>
          ))}
        </ol>

        <footer className="mt-auto flex flex-wrap justify-between gap-x-3 gap-y-1 border-t-2 border-dashed border-passport-200 pt-2 text-xs text-passport-500 dark:border-white/10 dark:text-passport-300">
          <span>
            📅 {fmtDate(g.finishedAt ?? g.startedAt)} · {goalOf(g)}
          </span>
          {isAdmin && <span className="font-bold">Creada por @{g.host}</span>}
        </footer>
      </div>
    </article>
  );
}
