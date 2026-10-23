import { AnimatePresence, motion } from 'framer-motion';

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Desde aqui el timer late y se pone rojo. */
const URGENT_SECONDS = 3;

/**
 * Reloj de la carta: un anillo que se vacia y cambia de color (verde → dorado → rojo).
 * En los ultimos segundos late y el numero "salta" en cada segundo.
 */
export function CardTimer(props: { remainingMs: number; totalSeconds: number; stopped: boolean; timedOut: boolean }) {
  const { remainingMs, totalSeconds, stopped, timedOut } = props;
  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = Math.min(1, remainingMs / (totalSeconds * 1000));
  const urgent = !stopped && seconds <= URGENT_SECONDS;
  const color = fraction > 0.5 ? 'var(--color-stamp-green)' : seconds > URGENT_SECONDS ? 'var(--color-brass)' : 'var(--color-stamp)';

  return (
    <motion.div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      aria-label={timedOut ? 'Tiempo agotado' : stopped ? 'Respondida a tiempo' : `Quedan ${seconds} segundos`}
      className="relative grid size-12 shrink-0 place-items-center"
      animate={urgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 0.6, repeat: Infinity } : { duration: 0.2 }}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={RADIUS} fill="none" strokeWidth="4" className="stroke-passport-800/10 dark:stroke-white/10" />
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 300ms' }}
        />
      </svg>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={seconds}
          initial={{ y: -6, opacity: 0, scale: 1.4 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 6, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="font-stamp text-base tabular-nums"
          style={{ color }}
        >
          {timedOut ? '⌛' : stopped ? '✓' : seconds}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
