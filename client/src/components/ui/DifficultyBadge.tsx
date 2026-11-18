import type { Difficulty } from '@roampass/shared';
import { useLabels } from '../../i18n/useLabels';

const STYLE: Record<Difficulty, string> = {
  EASY: 'bg-mint',
  MEDIUM: 'bg-sun',
  HARD: 'bg-coral',
};

/** Nivel de la carta y su bonus en millas. */
export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const meta = useLabels().difficulties[difficulty];
  return (
    <span className={`rounded-full border-2 border-ink px-2 py-0.5 text-xs font-bold whitespace-nowrap text-ink ${STYLE[difficulty]}`}>
      {meta.short ? `${meta.label} ${meta.short}` : meta.label}
    </span>
  );
}
