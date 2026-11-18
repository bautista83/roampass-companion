import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  AVATARS,
  BOARD_SPACES,
  MILES_PER_SPACE,
  WORLD_TOUR_MILES,
  DEFAULT_TIMER_SECONDS,
  MAX_PLAYERS,
  PAWN_COLORS,
  POINT_TARGETS,
  ROUND_TARGETS,
  localizeCard,
  type Difficulty,
  type RulesSectionId,
  type SeedData,
} from '@roampass/shared';
import seedData from '@roampass/shared/seedData.json';
import { useLabels, useRules } from '../../i18n/useLabels';
import { useThemeStore } from '../../store/themeStore';
import { DieFace } from '../game/Die';
import { CATEGORY_TINT } from '../game/categoryStyle';
import { usePointsHint } from '../game/usePointsHint';
import { PawnToken } from '../ui/PawnToken';

/** Mismos colores que DifficultyBadge, sin el texto del bonus (aqui va en la tabla). */
const DIFFICULTY_TINT: Record<Difficulty, string> = { EASY: 'bg-mint', MEDIUM: 'bg-sun', HARD: 'bg-coral' };

/** Algunos Eventos de Viajero reales del mazo: uno bueno y uno malo, alternados. */
const EVENT_EXAMPLES = (() => {
  const events = (seedData as SeedData).cards.flatMap((c) => (c.category === 'TRAVEL_EVENT' ? [c] : []));
  const good = events.filter((e) => e.points > 0);
  const bad = events.filter((e) => e.points < 0);
  return [good[0], bad[0], good[1], bad[1]].filter((e) => e !== undefined);
})();

/** Etiqueta de pastilla con el estilo sticker. */
function Chip({ children, className = 'bg-white' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 text-sm font-bold whitespace-nowrap text-ink ${className}`}>
      {children}
    </span>
  );
}

function GoalVisual() {
  const retro = useThemeStore((s) => s.retro);
  const { t } = useTranslation();
  const { miles } = useLabels();
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border-3 border-ink shadow-hard-sm dark:border-black">
        <img
          src={retro ? '/board/board-retro.png' : '/board/board.svg'}
          alt={t('rules.boardAlt')}
          className="block w-full"
          loading="lazy"
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <img src="/board/spaces/obelisco.svg" alt="" className="size-12" aria-hidden />
        <Chip className="bg-sun">{t('rules.oneSpace', { miles: miles(MILES_PER_SPACE) })}</Chip>
        <Chip>{t('rules.allSpaces', { count: BOARD_SPACES, miles: miles(WORLD_TOUR_MILES) })}</Chip>
      </div>
    </div>
  );
}

function SetupVisual() {
  const { t } = useTranslation();
  const { miles, targetLabel } = useLabels();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="sticker bg-sky p-3 text-center text-ink">
          <p className="text-3xl">🗺️🎲</p>
          <p className="text-sm font-extrabold">{t('rules.printedBoard')}</p>
          <p className="text-xs">{t('rules.printedBoardSub')}</p>
        </div>
        <div className="sticker bg-lilac p-3 text-center text-ink">
          <p className="text-3xl">📱</p>
          <p className="text-sm font-extrabold">{t('rules.digitalBoard')}</p>
          <p className="text-xs">{t('rules.digitalBoardSub')}</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {POINT_TARGETS.map((target) => (
          <Chip key={target} className="bg-sun">
            🏁 {miles(target)} · {targetLabel(target)}
          </Chip>
        ))}
        {ROUND_TARGETS.map((r) => (
          <Chip key={r}>{t('rules.rounds', { count: r })}</Chip>
        ))}
      </div>
      <div className="flex items-end justify-center gap-3">
        {PAWN_COLORS.slice(0, MAX_PLAYERS).map((color, i) => (
          <PawnToken key={color} color={color} avatar={AVATARS[i]!} className="w-10" />
        ))}
      </div>
    </div>
  );
}

function TurnVisual() {
  const { t } = useTranslation();
  const { categories } = useLabels();
  const { die } = useRules();
  const flow = [
    { icon: <DieFace face={1} size={44} />, text: t('rules.flow.roll') },
    { icon: <span className="text-4xl">{categories.LOCATION.icon}</span>, text: t('rules.flow.card') },
    { icon: <span className="text-4xl">⏱️</span>, text: t('rules.flow.timer', { seconds: DEFAULT_TIMER_SECONDS }) },
    { icon: <span className="text-4xl">✈️</span>, text: t('rules.flow.miles') },
  ];
  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {flow.map((s, i) => (
          <li key={s.text} className="panel flex flex-col items-center gap-1 p-3 text-center">
            <span className="grid h-12 place-items-center">{s.icon}</span>
            <span className="text-xs font-extrabold">
              {i + 1}. {s.text}
            </span>
          </li>
        ))}
      </ol>
      <div>
        <p className="label mb-2 text-center">{t('rules.dieTitle')}</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {die.map((d) => (
            <li key={d.face} className={`sticker flex items-center gap-2 p-2 text-ink shadow-hard-sm ${CATEGORY_TINT[d.category]}`}>
              <DieFace face={d.face} size={30} className="shrink-0" />
              <span className="min-w-0 text-xs leading-tight font-extrabold">
                {d.icon} {d.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CardsVisual() {
  const { t } = useTranslation();
  const { categories, num } = useLabels();
  const { difficulties, quizPoints, locationBrackets } = useRules();
  const pointsHint = usePointsHint();
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1.5 text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="text-left">
                <span className="label">{t('rules.cardColumn')}</span>
              </th>
              {difficulties.map((d) => (
                <th key={d.difficulty} className="px-1 text-center">
                  <span className={`rounded-full border-2 border-ink px-1.5 py-0.5 text-[11px] font-bold text-ink sm:px-2 sm:text-xs ${DIFFICULTY_TINT[d.difficulty]}`}>
                    {d.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quizPoints.map((q) => (
              <tr key={q.category}>
                <td className={`rounded-l-xl border-y-2 border-l-2 border-ink px-1.5 py-1.5 leading-tight font-bold sm:px-2 text-ink ${CATEGORY_TINT[q.category]}`}>
                  {q.icon} {q.label}
                </td>
                {difficulties.map((d, i) => (
                  <td
                    key={d.difficulty}
                    className={`border-y-2 border-ink bg-white px-1 py-1.5 text-center sm:px-2 font-extrabold text-ink tabular-nums ${
                      i === difficulties.length - 1 ? 'rounded-r-xl border-r-2' : ''
                    }`}
                  >
                    +{num(q.byDifficulty[d.difficulty])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`sticker p-3 text-ink ${CATEGORY_TINT.LOCATION}`}>
        <p className="mb-2 font-extrabold">
          {t('rules.locationTitle', { icon: categories.LOCATION.icon, label: categories.LOCATION.label })}
        </p>
        <ul className="space-y-1.5">
          {locationBrackets.map((b, i) => (
            <li key={b.maxKm} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 font-bold tabular-nums">
                {i === 0 ? t('rules.upTo') : t('rules.fromTo', { from: num(b.fromKm) })} {num(b.maxKm)} km
              </span>
              <span
                className="h-4 rounded-full border-2 border-ink bg-sun"
                style={{ width: `${(b.points / locationBrackets[0]!.points) * 60}%` }}
                aria-hidden
              />
              <span className="font-extrabold whitespace-nowrap tabular-nums">+{num(b.points)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs font-semibold">{t('rules.withBonus', { hint: pointsHint('LOCATION') })}</p>
      </div>
    </div>
  );
}

function TravelVisual() {
  const { t } = useTranslation();
  const { locale, miles } = useLabels();
  const { transports } = useRules();
  const events = useMemo(() => EVENT_EXAMPLES.map((e) => localizeCard(e, locale)), [locale]);
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${miles(Math.abs(n))}`;
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2">
        {events.map((e) => (
          <li key={e.id} className="sticker flex items-center gap-2 bg-white p-2 text-ink shadow-hard-sm dark:bg-passport-100">
            <span className="text-2xl" aria-hidden>
              {e.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-extrabold">{e.title}</span>
              <span className={`block text-sm font-extrabold tabular-nums ${e.points > 0 ? 'text-stamp-green' : 'text-stamp'}`}>
                {signed(e.points)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div>
        <p className="label mb-2 text-center">{t('rules.transportsTitle')}</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {transports.map((tr) => (
            <li key={tr.id} className="flex w-20 flex-col items-center gap-1 text-center">
              <img src={`/board/spaces/${tr.id}.svg`} alt="" className="size-12" loading="lazy" aria-hidden />
              <span className="text-[11px] leading-tight font-semibold">{tr.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WinVisual() {
  const podium = [
    { place: 2, color: PAWN_COLORS[1], avatar: AVATARS[1], h: 'h-16' },
    { place: 1, color: PAWN_COLORS[0], avatar: AVATARS[0], h: 'h-24' },
    { place: 3, color: PAWN_COLORS[2], avatar: AVATARS[2], h: 'h-10' },
  ] as const;
  return (
    <div className="flex items-end justify-center gap-3 pt-4">
      {podium.map((p) => (
        <div key={p.place} className="flex w-20 flex-col items-center gap-1">
          {p.place === 1 && <span className="text-3xl">🏆</span>}
          <PawnToken color={p.color} avatar={p.avatar} className="w-11" />
          <div className={`grid w-full place-items-center rounded-t-xl border-3 border-ink bg-sun font-display text-2xl text-ink ${p.h}`}>
            {p.place}
          </div>
        </div>
      ))}
    </div>
  );
}

const VISUALS: Record<RulesSectionId, () => ReactNode> = {
  goal: GoalVisual,
  setup: SetupVisual,
  turn: TurnVisual,
  cards: CardsVisual,
  travel: TravelVisual,
  win: WinVisual,
};

/**
 * Reglas del juego paso a paso. Los textos y numeros vienen de `@roampass/shared` (buildRules, en el
 * idioma activo), asi que se actualizan solos si cambia un puntaje. Se usa en la pantalla /rules y en el "?" de la partida.
 */
export function RulesGuide({ onFinish }: { onFinish?: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const { t } = useTranslation();
  const { sections } = useRules();
  const total = sections.length;
  const section = sections[step]!;
  const Visual = VISUALS[section.id];
  const last = step === total - 1;

  const go = (next: number) => {
    if (next < 0 || next >= total) return;
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(step + 1);
      if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Indice de pasos: se puede saltar a cualquiera */}
      <nav aria-label={t('rules.stepsAria')}>
        <ol className="flex flex-wrap justify-center gap-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <button
                onClick={() => go(i)}
                aria-current={i === step ? 'step' : undefined}
                title={s.title}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink px-3 text-sm font-bold text-ink transition ${
                  i === step ? 'bg-sun shadow-hard-sm' : i < step ? 'bg-mint' : 'bg-white dark:bg-passport-100'
                }`}
              >
                <span aria-hidden>{s.icon}</span>
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* Solo animacion de entrada: sin salida el alto no colapsa y los botones no saltan. */}
      <motion.section
          key={section.id}
          initial={{ x: 32 * dir, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start"
          aria-live="polite"
        >
          <div className="min-w-0">
            <p className="label">{t('rules.stepOf', { step: step + 1, total })}</p>
            <h2 className="mb-2 text-2xl md:text-3xl">
              {section.icon} {section.title}
            </h2>
            <p className="mb-3 font-semibold">{section.summary}</p>
            <ul className="space-y-2">
              {section.points.map((p, i) => (
                <li key={p} className="flex gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun text-xs font-extrabold text-ink">
                    {section.id === 'turn' ? i + 1 : '•'}
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel min-w-0 p-3 md:p-4">
            <Visual />
          </div>
      </motion.section>

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => go(step - 1)} disabled={step === 0}>
          {t('rules.previous')}
        </button>
        {last ? (
          onFinish && (
            <button className="btn-primary flex-1" onClick={onFinish}>
              {t('rules.play')}
            </button>
          )
        ) : (
          <button className="btn-primary flex-1" onClick={() => go(step + 1)}>
            {t('rules.next')}
          </button>
        )}
      </div>
    </div>
  );
}
