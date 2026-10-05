import { motion } from 'framer-motion';
import { CATEGORY_META, type TravelEventCard } from '@roampass/shared';
import { useGameStore, type ActiveDraw } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { CardResult } from './CardResult';

/** EVENTO DE VIAJERO: no hay pregunta, el efecto se aplica directamente al confirmar. */
export function TravelEventModal({ draw }: { draw: ActiveDraw }) {
  const card = draw.card as TravelEventCard;
  const resolve = useGameStore((s) => s.resolve);
  const player = useGameStore((s) => s.game?.players.find((p) => p.id === draw.playerId));
  const meta = CATEGORY_META.TRAVEL_EVENT;
  const good = card.points >= 0;

  return (
    <Modal open flip title={<span className="flex items-center gap-2"><span className="text-2xl">{meta.icon}</span>{meta.label}</span>}>
      <div className="flex flex-col items-center gap-5 p-6 text-center md:p-10">
        <motion.span
          className="text-7xl md:text-8xl"
          initial={{ y: -20, rotate: -20 }}
          animate={{ y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          aria-hidden
        >
          {card.icon}
        </motion.span>
        <h2 className={`font-stamp text-3xl tracking-wider uppercase md:text-4xl ${good ? 'text-stamp-green' : 'text-stamp'}`}>{card.title}</h2>
        <p className="max-w-md text-lg">{card.description}</p>

        {draw.resolved && player ? (
          <CardResult result={draw.resolved.result} playerName={player.name} />
        ) : (
          <button className={`${good ? 'btn-primary' : 'btn-danger'} w-full text-lg sm:w-auto`} onClick={() => resolve({ kind: 'EVENT', card })}>
            {good ? `Cobrar +${card.points} pts` : `Aceptar ${card.points} pts`} · {player?.avatar} {player?.name}
          </button>
        )}
      </div>
    </Modal>
  );
}
