import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { ScoreResult } from '@roampass/shared';
import { formatNumber } from '@roampass/shared';
import { useGameStore } from '../../store/gameStore';

/** Sello de aduana con el resultado de la carta + boton para pasar el turno. */
export function CardResult({ result, playerName, children }: { result: ScoreResult; playerName: string; children?: ReactNode }) {
  const dismiss = useGameStore((s) => s.dismissCard);
  const finished = useGameStore((s) => s.game?.status === 'FINISHED');
  const positive = result.delta > 0;
  const label = result.correct === null ? (positive ? 'Bonus' : 'Penalización') : result.correct ? 'Aprobado' : 'Denegado';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 text-center">
      <motion.div
        initial={{ scale: 3, opacity: 0, rotate: -25 }}
        animate={{ scale: 1, opacity: 1, rotate: -8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        className={`stamp text-2xl md:text-3xl ${positive ? 'border-stamp-green text-stamp-green' : 'border-stamp text-stamp'}`}
      >
        {label}
        <span className="block text-center text-3xl md:text-4xl">
          {result.delta > 0 ? '+' : ''}
          {formatNumber(result.delta)} pts
        </span>
      </motion.div>
      <p className="text-sm text-passport-500 dark:text-passport-300">
        para <strong className="text-passport-900 dark:text-white">{playerName}</strong>
      </p>
      {children}
      <button className="btn-primary w-full text-lg sm:w-auto" onClick={dismiss} autoFocus>
        {finished ? '🏆 Ver resultados' : 'Siguiente turno →'}
      </button>
    </motion.div>
  );
}
