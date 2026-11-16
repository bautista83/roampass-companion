import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { CATEGORY_META, DIE_FACES, rollDie, type CardCategory } from '@roampass/shared';
import { CATEGORY_HEX, CATEGORY_TINT, POINTS_HINT } from './categoryStyle';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

/**
 * Cara del dado dibujada en el estilo del tablero: color de la categoria, borde negro y sombra dura.
 * `flat` la dibuja sin sombra, para las caras del dado 3D.
 */
export function DieFace({ face, size = 80, className = '', flat = false }: { face: number; size?: number; className?: string; flat?: boolean }) {
  const category = DIE_FACES[face - 1]!;
  const box = flat ? '0 0 100 100' : '0 0 108 108';
  return (
    <svg viewBox={box} width={size} height={size} className={className} aria-hidden>
      {!flat && <rect x="10" y="10" width="94" height="94" rx="22" fill="#111111" />}
      <rect x="3" y="3" width="94" height="94" rx={flat ? 16 : 22} fill={CATEGORY_HEX[category]} stroke="#111111" strokeWidth="5" />
      {PIPS[face]!.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={face === 1 ? 11 : 9} fill="#111111" />
      ))}
    </svg>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SIZE = 84;
/** Donde va cada cara en el cubo y como girarlo para que quede de frente. */
const FACE_PLACE: Record<number, string> = {
  1: 'rotateY(0deg)',
  2: 'rotateY(90deg)',
  3: 'rotateX(90deg)',
  4: 'rotateX(-90deg)',
  5: 'rotateY(-90deg)',
  6: 'rotateY(180deg)',
};
const FACE_TURN: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

/** Carta que salio, en grande, antes de abrir la pregunta (y su reloj). */
function RevealCard({ face, category, onDone }: { face: number; category: CardCategory; onDone: () => void }) {
  const meta = CATEGORY_META[category];
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[950] grid place-items-center bg-ink/55 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
      style={{ perspective: 1200 }}
      role="status"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.p
          className="sticker bg-white px-5 py-2 font-display text-2xl text-ink md:text-3xl"
          initial={{ y: -40, opacity: 0, rotate: -6 }}
          animate={{ y: 0, opacity: 1, rotate: -3 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 14 }}
        >
          ¡Salió el {face}!
        </motion.p>
        <motion.div
          className={`sticker flex w-72 flex-col items-center gap-3 p-6 text-center text-ink shadow-hard-lg md:w-80 ${CATEGORY_TINT[category]}`}
          initial={{ rotateY: 180, scale: 0.3, rotate: -20 }}
          animate={{ rotateY: 0, scale: [0.3, 1.12, 1], rotate: [-20, 4, -2, 2, 0] }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          <DieFace face={face} size={72} />
          <motion.span
            className="text-7xl"
            aria-hidden
            animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.15, 1] }}
            transition={{ delay: 0.9, duration: 0.8 }}
          >
            {meta.icon}
          </motion.span>
          <span className="font-display text-3xl leading-tight">{meta.label}</span>
          <span className="text-sm font-semibold text-ink/75">{meta.hint}</span>
          <span className="rounded-full border-2 border-ink bg-white px-3 py-1 text-sm font-bold">{POINTS_HINT[category]}</span>
        </motion.div>
        <p className="text-sm font-bold text-white">Tocá para empezar</p>
      </div>
    </motion.div>,
    document.body,
  );
}

/**
 * Dado 3D de la partida: al tocarlo salta, gira en el aire y cae en una cara. Despues se muestra en
 * grande la carta que salio y recien ahi se abre (1 Lugar · 2 Bandera · 3 Ciudades · 4 Historia ·
 * 5 Personalidades · 6 Evento). Si cae en una categoria agotada vuelve a tirar solo.
 */
export function Die(props: {
  disabled: boolean;
  available: (category: CardCategory) => boolean;
  onRolled: (category: CardCategory) => void;
  /** Texto debajo del dado cuando esta en reposo. */
  hint?: string;
}) {
  const { disabled, available, onRolled, hint } = props;
  const [rolling, setRolling] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ face: number; category: CardCategory } | null>(null);
  const rx = useMotionValue(-18);
  const ry = useMotionValue(24);
  const toss = useMotionValue(0);
  const shadowScale = useTransform(toss, [-90, 0], [0.45, 1]);

  // Al cambiar de turno se borra el resultado de la tirada anterior.
  useEffect(() => setNote(null), [hint]);

  async function spinTo(face: number, spins: number, seconds: number) {
    const [fx, fy] = FACE_TURN[face]!;
    const baseX = Math.ceil(rx.get() / 360) * 360 + 360 * spins;
    const baseY = Math.ceil(ry.get() / 360) * 360 + 360 * (spins + 1);
    await Promise.all([
      animate(rx, baseX + fx, { duration: seconds, ease: [0.15, 0.6, 0.25, 1] }),
      animate(ry, baseY + fy, { duration: seconds, ease: [0.15, 0.6, 0.25, 1] }),
      animate(toss, [0, -90, 0, -22, 0], { duration: seconds, times: [0, 0.35, 0.7, 0.85, 1], ease: 'easeOut' }),
    ]);
  }

  async function roll() {
    if (disabled || rolling) return;
    const result = rollDie(available);
    if (!result) {
      setNote('No quedan cartas en ninguna categoría');
      return;
    }
    setRolling(true);
    setNote('¡Rodando!');
    for (const again of result.rerolls) {
      await spinTo(again, 2, 1.3);
      setNote(`${CATEGORY_META[DIE_FACES[again - 1]!].label} agotada: ¡otra vez!`);
      await sleep(700);
    }
    await spinTo(result.face, 3, 1.6);
    setNote(`${result.face} · ${CATEGORY_META[result.category].icon} ${CATEGORY_META[result.category].label}`);
    await sleep(350);
    setReveal(result);
  }

  function finishReveal() {
    if (!reveal) return;
    const { category } = reveal;
    setReveal(null);
    setRolling(false);
    onRolled(category);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={roll}
        disabled={disabled || rolling}
        aria-label="Tirar el dado"
        className="group relative grid place-items-center rounded-3xl pt-6 pb-3 transition disabled:cursor-not-allowed"
        style={{ perspective: 600, width: SIZE + 40, height: SIZE + 46 }}
      >
        <motion.span
          className="absolute bottom-1 h-3 rounded-[50%] bg-ink/30"
          style={{ width: SIZE, scaleX: shadowScale, opacity: shadowScale }}
          aria-hidden
        />
        <motion.span
          className={`relative block transition-opacity ${disabled && !rolling ? 'opacity-50' : 'group-hover:-translate-y-1'}`}
          style={{ width: SIZE, height: SIZE, transformStyle: 'preserve-3d', rotateX: rx, rotateY: ry, y: toss }}
        >
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <span
              key={f}
              className="absolute inset-0"
              style={{ transform: `${FACE_PLACE[f]} translateZ(${SIZE / 2}px)`, backfaceVisibility: 'hidden' }}
            >
              <DieFace face={f} size={SIZE} flat />
            </span>
          ))}
        </motion.span>
      </button>
      <p className="min-h-5 text-center text-sm font-bold" aria-live="polite">
        {note ?? hint}
      </p>
      <AnimatePresence>
        {reveal && <RevealCard key="reveal" face={reveal.face} category={reveal.category} onDone={finishReveal} />}
      </AnimatePresence>
    </div>
  );
}
