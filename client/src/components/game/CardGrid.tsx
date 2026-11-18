import { motion } from 'framer-motion';
import { CARD_CATEGORIES, dieFaceOf, type CardCategory } from '@roampass/shared';
import { useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';
import { CATEGORY_TINT } from './categoryStyle';
import { usePointsHint } from './usePointsHint';
import { DieFace } from './Die';

/** Cada carta queda apenas girada como un sticker. */
const TILT = ['-rotate-1', 'rotate-1', '-rotate-[0.5deg]', 'rotate-[0.5deg]', '-rotate-1', 'rotate-1'];

/**
 * Mazo de 6 tarjetas, una por cara del dado (1 Lugar ... 6 Evento).
 * - Tablero fisico: se tira el dado (real o el de la app) y se toca la carta del numero.
 *   Movil: 2 columnas x 3 filas. Tablet: 3 x 2.
 * - Tablero digital (`compact`): las cartas son la referencia del dado; las abre el dado.
 * Las cartas no se repiten en la partida: una categoria sin cartas nuevas queda "Agotada".
 */
export function CardGrid(props: {
  disabled: boolean;
  remaining: Record<CardCategory, number>;
  onDraw: (c: CardCategory) => void;
  compact?: boolean;
}) {
  const { disabled, remaining, onDraw, compact = false } = props;
  const { t } = useTranslation();
  const { categories } = useLabels();
  const pointsHint = usePointsHint();

  if (compact) {
    return (
      <ul className="grid grid-cols-3 gap-2 xl:grid-cols-6" aria-label={t('game.cards.byDieAria')}>
        {CARD_CATEGORIES.map((category, i) => {
          const meta = categories[category];
          const left = remaining[category];
          return (
            <li
              key={category}
              className={`sticker flex items-center gap-2 p-2 text-ink shadow-hard-sm ${CATEGORY_TINT[category]} ${TILT[i]} ${left === 0 ? 'opacity-50 grayscale' : ''}`}
            >
              <DieFace face={dieFaceOf(category)} size={30} className="shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-xs leading-tight font-extrabold">
                  {meta.icon} {meta.label}
                </span>
                <span className="block text-[10px] font-semibold text-ink/70 tabular-nums">
                  {left === 0 ? t('game.cards.exhausted') : t('game.cards.left', { count: left })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      {CARD_CATEGORIES.map((category, i) => {
        const meta = categories[category];
        const left = remaining[category];
        const exhausted = left === 0;
        const locked = disabled || exhausted;
        return (
          <motion.button
            key={category}
            disabled={locked}
            onClick={() => onDraw(category)}
            initial={{ rotateY: 180, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 160, damping: 18 }}
            whileHover={locked ? undefined : { y: -4 }}
            whileTap={locked ? undefined : { scale: 0.95, rotateZ: -1 }}
            className={`sticker group relative flex min-h-36 flex-col justify-between overflow-hidden p-3 text-left text-ink transition disabled:cursor-not-allowed disabled:grayscale-[0.7] disabled:opacity-60 sm:min-h-44 md:aspect-[4/5] md:min-h-0 md:p-4 ${CATEGORY_TINT[category]} ${TILT[i % TILT.length]}`}
            aria-label={
              exhausted
                ? t('game.cards.exhaustedAria', { label: meta.label })
                : t('game.cards.drawAria', { label: meta.label, face: dieFaceOf(category) })
            }
          >
            <span className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <DieFace face={dieFaceOf(category)} size={34} className="shrink-0" />
                <span className="text-3xl md:text-4xl" aria-hidden>
                  {meta.icon}
                </span>
              </span>
              <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-[11px] font-bold whitespace-nowrap tabular-nums">
                {exhausted ? t('game.cards.exhausted') : t('game.cards.left', { count: left })}
              </span>
            </span>
            <span>
              <span className="block font-display text-base leading-tight break-words hyphens-auto sm:text-lg md:text-[clamp(0.95rem,1.6vw,1.25rem)]">{meta.label}</span>
              <span className="block text-xs font-medium text-ink/70">{meta.hint}</span>
              <span className="mt-1.5 inline-block rounded-full border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold whitespace-nowrap tabular-nums">{pointsHint(category)}</span>
            </span>
            {exhausted && (
              <span className="stamp pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-ink bg-white/80 text-lg text-ink" aria-hidden>
                {t('game.cards.exhausted')}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
