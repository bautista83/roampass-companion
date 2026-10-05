import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AVATARS,
  formatNumber,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PAWN_COLOR_META,
  PAWN_COLORS,
  POINT_TARGETS,
  ROUND_TARGETS,
  validatePlayers,
  type PawnColor,
  type PlayerSetup,
  type VictoryMode,
} from '@roampass/shared';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';

const MODES: { mode: VictoryMode; title: string; icon: string; desc: string; targets: readonly number[]; unit: string }[] = [
  { mode: 'POINTS', title: 'Límite de Puntos', icon: '🎯', desc: 'Gana el primero en llegar a la meta.', targets: POINT_TARGETS, unit: 'pts' },
  { mode: 'ROUNDS', title: 'Número de Rondas', icon: '🔁', desc: 'Al terminar las rondas, gana quien tenga más puntos.', targets: ROUND_TARGETS, unit: 'rondas' },
];

const firstFreeColor = (players: PlayerSetup[]) => PAWN_COLORS.find((c) => !players.some((p) => p.color === c))!;

/** Wizard: Paso 1 condición de victoria · Paso 2 jugadores (2-4). */
export function GameSetup() {
  const user = useAuthStore((s) => s.user);
  const startGame = useGameStore((s) => s.startGame);
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<VictoryMode>('POINTS');
  const [target, setTarget] = useState<number>(POINT_TARGETS[1]);
  const [players, setPlayers] = useState<PlayerSetup[]>([
    { name: user?.username ?? 'Jugador 1', color: 'red', avatar: AVATARS[0] },
    { name: '', color: 'blue', avatar: AVATARS[1] },
  ]);
  /** Índice del peón que controla el usuario logueado (cuenta para su récord). */
  const [selfIndex, setSelfIndex] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseMode = (m: VictoryMode) => {
    setMode(m);
    setTarget(m === 'POINTS' ? POINT_TARGETS[1] : ROUND_TARGETS[0]);
  };

  const update = (i: number, patch: Partial<PlayerSetup>) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const addPlayer = () =>
    setPlayers((ps) => [...ps, { name: '', color: firstFreeColor(ps), avatar: AVATARS[ps.length % AVATARS.length]! }]);

  const removePlayer = (i: number) => {
    setPlayers((ps) => ps.filter((_, j) => j !== i));
    setSelfIndex((s) => (s === i ? null : s !== null && s > i ? s - 1 : s));
  };

  async function start() {
    setError(null);
    try {
      validatePlayers(players);
      setBusy(true);
      await startGame({ mode, target }, players, selfIndex);
      navigate('/play');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-5 flex items-center gap-2 text-sm font-semibold" aria-label="Pasos">
        {['Condición de victoria', 'Jugadores'].map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full ${
                step === i + 1 ? 'bg-passport-700 text-white dark:bg-brass dark:text-passport-950' : 'bg-passport-800/10 dark:bg-white/10'
              }`}
            >
              {i + 1}
            </span>
            <span className={step === i + 1 ? '' : 'text-passport-400'}>{label}</span>
            {i === 0 && <span className="h-px flex-1 bg-passport-800/15 dark:bg-white/15" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.section
            key="s1"
            className="panel space-y-5 p-4 md:p-6"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
          >
            <h1 className="text-2xl font-bold">¿Cómo se gana este viaje?</h1>
            <div className="grid gap-3 md:grid-cols-2">
              {MODES.map((m) => {
                const selected = mode === m.mode;
                return (
                  <div
                    key={m.mode}
                    className={`rounded-2xl border-2 p-4 transition ${
                      selected ? 'border-passport-600 bg-passport-50 dark:border-brass dark:bg-brass/10' : 'border-passport-800/10 dark:border-white/10'
                    }`}
                  >
                    <button className="flex w-full min-h-12 items-start gap-3 text-left" onClick={() => chooseMode(m.mode)} aria-pressed={selected}>
                      <span className="text-3xl">{m.icon}</span>
                      <span>
                        <span className="block text-lg font-bold">{m.title}</span>
                        <span className="text-sm text-passport-500 dark:text-passport-300">{m.desc}</span>
                      </span>
                    </button>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {m.targets.map((t) => (
                        <button
                          key={t}
                          disabled={!selected}
                          onClick={() => setTarget(t)}
                          aria-pressed={selected && target === t}
                          className={`min-h-12 rounded-xl text-sm font-bold tabular-nums transition disabled:opacity-40 ${
                            selected && target === t
                              ? 'bg-passport-700 text-white dark:bg-brass dark:text-passport-950'
                              : 'bg-white ring-1 ring-passport-800/15 dark:bg-passport-950 dark:ring-white/15'
                          }`}
                        >
                          {formatNumber(t)}
                          <span className="block text-[10px] font-medium opacity-70">{m.unit}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              <button className="btn-ghost" onClick={() => navigate('/')}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={() => setStep(2)}>
                Siguiente →
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="s2"
            className="panel space-y-4 p-4 md:p-6"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
          >
            <div className="flex items-end justify-between gap-3">
              <h1 className="text-2xl font-bold">Viajeros</h1>
              <span className="text-sm text-passport-500 dark:text-passport-300">
                {players.length}/{MAX_PLAYERS} · {mode === 'POINTS' ? `${formatNumber(target)} pts` : `${target} rondas`}
              </span>
            </div>

            <ul className="space-y-3">
              {players.map((p, i) => (
                <PlayerRow
                  key={i}
                  index={i}
                  player={p}
                  takenColors={players.filter((_, j) => j !== i).map((o) => o.color)}
                  isSelf={selfIndex === i}
                  canRemove={players.length > MIN_PLAYERS}
                  onChange={(patch) => update(i, patch)}
                  onRemove={() => removePlayer(i)}
                  onToggleSelf={() => setSelfIndex(selfIndex === i ? null : i)}
                  selfLabel={user?.username ?? ''}
                />
              ))}
            </ul>

            {players.length < MAX_PLAYERS && (
              <button className="btn-ghost w-full border-dashed" onClick={addPlayer}>
                + Agregar jugador/equipo
              </button>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-stamp/10 px-3 py-2 text-sm font-medium text-stamp">
                {error}
              </p>
            )}

            <div className="flex justify-between gap-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>
                ← Atrás
              </button>
              <button className="btn-primary text-lg" onClick={start} disabled={busy}>
                {busy ? 'Barajando mazo…' : '🛫 Comenzar partida'}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerRow(props: {
  index: number;
  player: PlayerSetup;
  takenColors: PawnColor[];
  isSelf: boolean;
  canRemove: boolean;
  selfLabel: string;
  onChange: (patch: Partial<PlayerSetup>) => void;
  onRemove: () => void;
  onToggleSelf: () => void;
}) {
  const { index, player, takenColors, isSelf, canRemove, selfLabel, onChange, onRemove, onToggleSelf } = props;
  return (
    <li className="rounded-2xl border border-passport-800/10 p-3 dark:border-white/10" style={{ borderLeft: `6px solid ${PAWN_COLOR_META[player.color].hex}` }}>
      <div className="flex gap-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-passport-800/5 text-2xl dark:bg-white/5">{player.avatar}</span>
        <input
          className="input"
          placeholder={`Jugador / equipo ${index + 1}`}
          value={player.name}
          maxLength={30}
          aria-label={`Nombre del jugador ${index + 1}`}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {canRemove && (
          <button className="btn-ghost size-12 shrink-0 px-0" onClick={onRemove} aria-label={`Quitar jugador ${index + 1}`}>
            ✕
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="label">Peón 3D</legend>
          <div className="flex flex-wrap gap-1.5">
            {PAWN_COLORS.map((c) => {
              const taken = takenColors.includes(c);
              return (
                <button
                  key={c}
                  disabled={taken}
                  onClick={() => onChange({ color: c })}
                  aria-label={`Color ${PAWN_COLOR_META[c].label}${taken ? ' (ocupado)' : ''}`}
                  aria-pressed={player.color === c}
                  className={`size-11 rounded-full ring-offset-2 ring-offset-paper transition disabled:opacity-20 dark:ring-offset-passport-900 ${
                    player.color === c ? 'ring-4 ring-passport-700 dark:ring-brass' : ''
                  }`}
                  style={{ background: PAWN_COLOR_META[c].hex }}
                />
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Avatar</legend>
          <div className="flex flex-wrap gap-1">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => onChange({ avatar: a })}
                aria-pressed={player.avatar === a}
                aria-label={`Avatar ${a}`}
                className={`size-11 rounded-lg text-xl transition ${
                  player.avatar === a ? 'bg-passport-700/15 ring-2 ring-passport-700 dark:bg-brass/20 dark:ring-brass' : ''
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-5 accent-passport-700" checked={isSelf} onChange={onToggleSelf} />
        Este peón soy yo (@{selfLabel}) — cuenta para mi récord
      </label>
    </li>
  );
}
