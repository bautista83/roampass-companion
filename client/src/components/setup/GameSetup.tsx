import { useState } from 'react';
import { AvatarIcon, PawnToken } from '../ui/PawnToken';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  AVATARS,
  BOARD,
  DEFAULT_TIMER_SECONDS,
  DIFFICULTIES,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PAWN_COLOR_META,
  PAWN_COLORS,
  POINT_TARGETS,
  ROUND_TARGETS,
  TIMER_OPTIONS,
  validatePlayers,
  type BoardMode,
  type PawnColor,
  type PlayerSetup,
  type VictoryMode,
} from '@roampass/shared';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { DifficultyBadge } from '../ui/DifficultyBadge';

// Textos en setup.victory.<mode> y setup.board.<board>.
const MODES: { mode: VictoryMode; icon: string; targets: readonly number[] }[] = [
  { mode: 'POINTS', icon: '🌎', targets: POINT_TARGETS },
  { mode: 'ROUNDS', icon: '🔁', targets: ROUND_TARGETS },
];

const BOARDS: { board: BoardMode; icon: string }[] = [
  { board: 'PHYSICAL', icon: '🎲' },
  { board: 'DIGITAL', icon: '🗺️' },
];

const firstFreeColor = (players: PlayerSetup[]) => PAWN_COLORS.find((c) => !players.some((p) => p.color === c))!;

/** Wizard: Paso 1 tablero · Paso 2 condición de victoria · Paso 3 jugadores. */
export function GameSetup() {
  const user = useAuthStore((s) => s.user);
  const startGame = useGameStore((s) => s.startGame);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { num, miles } = useLabels();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [board, setBoard] = useState<BoardMode>('DIGITAL');
  const [mode, setMode] = useState<VictoryMode>('POINTS');
  const [target, setTarget] = useState<number>(POINT_TARGETS[1]);
  const [players, setPlayers] = useState<PlayerSetup[]>([
    { name: user?.username ?? t('setup.players.defaultName'), color: 'red', avatar: AVATARS[0] },
    { name: '', color: 'blue', avatar: AVATARS[1] },
  ]);
  /** Índice del peón que controla el usuario logueado (cuenta para su récord). */
  const [selfIndex, setSelfIndex] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(DEFAULT_TIMER_SECONDS);
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
      await startGame({ mode, target, board }, players, selfIndex, timerSeconds);
      navigate('/play');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-5 flex items-center gap-2 text-sm font-semibold" aria-label={t('setup.steps.aria')}>
        {[t('setup.steps.board'), t('setup.steps.victory'), t('setup.steps.players')].map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full ${
                step === i ? 'bg-passport-700 text-white dark:bg-brass dark:text-passport-950' : 'bg-passport-800/10 dark:bg-white/10'
              }`}
            >
              {i + 1}
            </span>
            <span className={`hidden sm:inline ${step === i ? '' : 'text-passport-400'}`}>{label}</span>
            {i < 2 && <span className="h-px flex-1 bg-passport-800/15 dark:bg-white/15" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.section
            key="s0"
            className="panel space-y-5 p-4 md:p-6"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
          >
            <h1 className="text-2xl font-bold">{t('setup.board.title')}</h1>
            <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label={t('setup.steps.board')}>
              {BOARDS.map((b, i) => {
                const selected = board === b.board;
                return (
                  <button
                    key={b.board}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setBoard(b.board)}
                    className={`sticker flex min-h-40 flex-col items-start gap-2 p-5 text-left transition ${
                      i === 0 ? '-rotate-1' : 'rotate-1'
                    } ${selected ? (b.board === 'DIGITAL' ? 'bg-sky' : 'bg-sun') : 'bg-white opacity-70 hover:opacity-100 dark:bg-[#2a2f2a]'}`}
                  >
                    <span className="text-5xl" aria-hidden>
                      {b.icon}
                    </span>
                    <span className="font-display text-xl text-ink dark:text-inherit">{t(`setup.board.${b.board}.title`)}</span>
                    <span className="text-sm font-medium text-ink/75 dark:text-inherit">
                      {t(`setup.board.${b.board}.desc`, { start: BOARD.spaces[0]!.name })}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              <button className="btn-ghost" onClick={() => navigate('/')}>
                {t('common.actions.cancel')}
              </button>
              <button className="btn-primary" onClick={() => setStep(1)}>
                {t('setup.nav.next')}
              </button>
            </div>
          </motion.section>
        ) : step === 1 ? (
          <motion.section
            key="s1"
            className="panel space-y-5 p-4 md:p-6"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
          >
            <h1 className="text-2xl font-bold">{t('setup.victory.title')}</h1>
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
                        <span className="block text-lg font-bold">{t(`setup.victory.${m.mode}.title`)}</span>
                        <span className="text-sm text-passport-500 dark:text-passport-300">{t(`setup.victory.${m.mode}.desc`)}</span>
                      </span>
                    </button>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {m.targets.map((value) => (
                        <button
                          key={value}
                          disabled={!selected}
                          onClick={() => setTarget(value)}
                          aria-pressed={selected && target === value}
                          className={`min-h-12 rounded-xl text-sm font-bold tabular-nums transition disabled:opacity-40 ${
                            selected && target === value
                              ? 'bg-passport-700 text-white dark:bg-brass dark:text-passport-950'
                              : 'bg-white ring-1 ring-passport-800/15 dark:bg-passport-950 dark:ring-white/15'
                          }`}
                        >
                          {num(value)}
                          <span className="block text-[10px] font-medium opacity-70">{t(`setup.victory.${m.mode}.unit`)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-2xl border-2 border-passport-800/10 p-4 dark:border-white/10">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-bold">{t('setup.victory.timerTitle')}</p>
                  <p className="text-sm text-passport-500 dark:text-passport-300">
                    {t('setup.victory.timerDesc')}
                  </p>
                </div>
                <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('setup.victory.timerAria')}>
                  {TIMER_OPTIONS.map((value) => (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={timerSeconds === value}
                      onClick={() => setTimerSeconds(value)}
                      className={`min-h-12 min-w-14 rounded-xl px-3 font-bold tabular-nums transition ${
                        timerSeconds === value
                          ? 'bg-passport-700 text-white dark:bg-brass dark:text-passport-950'
                          : 'bg-white ring-1 ring-passport-800/15 hover:ring-passport-500 dark:bg-passport-950 dark:ring-white/15'
                      }`}
                    >
                      {value}
                      <span className="text-xs font-medium opacity-70">{t('setup.victory.secondsUnit')}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-passport-800/20 p-3 text-sm dark:border-white/15">
              <span>{t('setup.victory.levels')}</span>
              {DIFFICULTIES.map((d) => (
                <DifficultyBadge key={d} difficulty={d} />
              ))}
              <span className="w-full text-xs text-passport-500 dark:text-passport-300">
                {t('setup.victory.noRepeat')}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <button className="btn-ghost" onClick={() => setStep(0)}>
                {t('setup.nav.back')}
              </button>
              <button className="btn-primary" onClick={() => setStep(2)}>
                {t('setup.nav.next')}
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
              <h1 className="text-2xl font-bold">{t('setup.players.title')}</h1>
              <span className="text-sm text-passport-500 dark:text-passport-300">
                {t('setup.players.summary', {
                  count: players.length,
                  max: MAX_PLAYERS,
                  goal: mode === 'POINTS' ? miles(target) : t('setup.players.goalRounds', { count: target }),
                  seconds: timerSeconds,
                })}
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
                {t('setup.players.add')}
              </button>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-stamp/10 px-3 py-2 text-sm font-medium text-stamp">
                {error}
              </p>
            )}

            <div className="flex justify-between gap-2">
              <button className="btn-ghost" onClick={() => setStep(1)}>
                {t('setup.nav.back')}
              </button>
              <button className="btn-primary text-lg" onClick={start} disabled={busy}>
                {busy ? t('setup.nav.starting') : t('setup.nav.start')}
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
  const { t } = useTranslation();
  const { pawnColors } = useLabels();
  return (
    <li className="rounded-2xl border border-passport-800/10 p-3 dark:border-white/10" style={{ borderLeft: `6px solid ${PAWN_COLOR_META[player.color].hex}` }}>
      <div className="flex gap-2">
        <PawnToken avatar={player.avatar} color={player.color} className="w-10 shrink-0" />
        <input
          className="input"
          placeholder={t('setup.players.placeholder', { n: index + 1 })}
          value={player.name}
          maxLength={30}
          aria-label={t('setup.players.nameAria', { n: index + 1 })}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {canRemove && (
          <button className="btn-ghost size-12 shrink-0 px-0" onClick={onRemove} aria-label={t('setup.players.removeAria', { n: index + 1 })}>
            ✕
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="label">{t('setup.players.pawn')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {PAWN_COLORS.map((c) => {
              const taken = takenColors.includes(c);
              return (
                <button
                  key={c}
                  disabled={taken}
                  onClick={() => onChange({ color: c })}
                  aria-label={`${t('setup.players.colorAria', { color: pawnColors[c].label })}${taken ? t('setup.players.colorTaken') : ''}`}
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
          <legend className="label">{t('setup.players.avatar')}</legend>
          <div className="flex flex-wrap gap-1">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => onChange({ avatar: a })}
                aria-pressed={player.avatar === a}
                aria-label={t('setup.players.avatarAria', { avatar: a })}
                className={`grid size-11 place-items-center rounded-lg transition ${
                  player.avatar === a ? 'bg-passport-700/15 ring-2 ring-passport-700 dark:bg-brass/20 dark:ring-brass' : ''
                }`}
              >
                <AvatarIcon avatar={a} className="size-8" />
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="mt-2 flex min-h-12 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-5 accent-passport-700" checked={isSelf} onChange={onToggleSelf} />
        {t('setup.players.isSelf', { name: selfLabel })}
      </label>
    </li>
  );
}
