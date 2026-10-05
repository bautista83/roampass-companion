import { DIFFICULTY_META, type Difficulty } from '@roampass/shared';

const STYLE: Record<Difficulty, string> = {
  EASY: 'bg-stamp-green/15 text-stamp-green',
  MEDIUM: 'bg-brass/20 text-brass',
  HARD: 'bg-stamp/15 text-stamp',
};

/** Nivel de la carta y su multiplicador de puntos. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const meta = DIFFICULTY_META[difficulty];
  return (
    <span className={`rounded-full px-2 py-0.5 font-stamp text-xs whitespace-nowrap ${STYLE[difficulty]}`}>
      {meta.label} {meta.short}
    </span>
  );
}
