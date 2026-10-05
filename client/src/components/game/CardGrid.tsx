import { motion } from 'framer-motion';
import { CARD_CATEGORIES, CATEGORY_META, LOCATION_BRACKETS, QUIZ_POINTS, type CardCategory } from '@roampass/shared';

const POINTS_HINT: Record<CardCategory, string> = {
  LOCATION: `hasta +${LOCATION_BRACKETS[0].points}`,
  FLAG: `+${QUIZ_POINTS.FLAG}`,
  CITY: `+${QUIZ_POINTS.CITY}`,
  HISTORY: `+${QUIZ_POINTS.HISTORY}`,
  PERSONALITY: `+${QUIZ_POINTS.PERSONALITY}`,
  TRAVEL_EVENT: '± sorpresa',
};

const TINT: Record<CardCategory, string> = {
  LOCATION: 'from-emerald-600 to-teal-800',
  FLAG: 'from-sky-600 to-blue-800',
  CITY: 'from-violet-600 to-indigo-800',
  HISTORY: 'from-amber-600 to-orange-800',
  PERSONALITY: 'from-rose-600 to-pink-800',
  TRAVEL_EVENT: 'from-slate-600 to-passport-800',
};

/**
 * Mazo de 6 tarjetas. El jugador toca la categoria de la casilla donde cayo su peon fisico.
 * Movil: 2 columnas x 3 filas. Tablet: 3 x 2.
 */
export function CardGrid({ disabled, onDraw }: { disabled: boolean; onDraw: (c: CardCategory) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      {CARD_CATEGORIES.map((category, i) => {
        const meta = CATEGORY_META[category];
        return (
          <motion.button
            key={category}
            disabled={disabled}
            onClick={() => onDraw(category)}
            initial={{ rotateY: 180, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 160, damping: 18 }}
            whileHover={disabled ? undefined : { y: -4 }}
            whileTap={disabled ? undefined : { scale: 0.95, rotateZ: -1 }}
            className={`group relative flex min-h-36 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-left text-white shadow-lg ring-1 ring-black/10 transition disabled:cursor-not-allowed disabled:grayscale-[0.7] disabled:opacity-60 sm:min-h-44 md:aspect-[4/5] md:min-h-0 md:p-4 ${TINT[category]}`}
            aria-label={`Robar carta ${meta.label}`}
          >
            {/* borde perforado tipo ticket */}
            <span className="pointer-events-none absolute inset-1.5 rounded-xl border-2 border-dashed border-white/25" aria-hidden />
            <span className="text-4xl drop-shadow md:text-5xl" aria-hidden>
              {meta.icon}
            </span>
            <span>
              <span className="block text-base leading-tight font-extrabold sm:text-lg md:text-xl">{meta.label}</span>
              <span className="block text-xs text-white/75">{meta.hint}</span>
              <span className="mt-1.5 inline-block rounded-full bg-black/25 px-2 py-0.5 font-stamp text-xs">{POINTS_HINT[category]}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
