import { CATEGORY_META, QUIZ_POINTS, flagUrl, type QuizCard } from '@roampass/shared';
import { useGameStore, type ActiveDraw } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { CardImage } from '../ui/CardImage';
import { CardResult } from './CardResult';

/** Cartas de seleccion multiple: BANDERA, CAPITALES Y CIUDADES, HISTORIA y PERSONALIDADES. */
export function QuizModal({ draw }: { draw: ActiveDraw }) {
  const card = draw.card as QuizCard;
  const resolve = useGameStore((s) => s.resolve);
  const player = useGameStore((s) => s.game?.players.find((p) => p.id === draw.playerId));
  const meta = CATEGORY_META[card.category];
  const resolved = draw.resolved;
  const image = card.category === 'FLAG' && card.countryCode ? flagUrl(card.countryCode, 640) : card.imageUrl;
  const options = draw.options ?? card.options;

  const optionClass = (opt: string) => {
    if (!resolved) return 'bg-white ring-1 ring-passport-800/15 hover:ring-2 hover:ring-passport-500 dark:bg-passport-950 dark:ring-white/15';
    if (opt === card.correctAnswer) return 'bg-stamp-green text-white ring-2 ring-stamp-green';
    if (opt === resolved.answer) return 'bg-stamp text-white ring-2 ring-stamp';
    return 'opacity-40 ring-1 ring-passport-800/10 dark:ring-white/10';
  };

  return (
    <Modal
      open
      flip
      title={
        <span className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <span>{meta.label}</span>
          <span className="rounded-full bg-brass/20 px-2 py-0.5 font-stamp text-xs text-brass">+{QUIZ_POINTS[card.category]}</span>
        </span>
      }
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <p className="text-sm text-passport-500 dark:text-passport-300">
          Turno de <strong className="text-passport-900 dark:text-white">{player?.avatar} {player?.name}</strong>
        </p>

        {image && (
          <CardImage
            src={image}
            alt={card.category === 'FLAG' ? 'Bandera misteriosa' : card.prompt}
            credit={card.credit}
            className={`mx-auto w-full rounded-xl ${card.category === 'FLAG' ? 'max-w-sm bg-transparent shadow-lg' : 'max-w-md'}`}
            imgClassName={`mx-auto w-full ${card.category === 'FLAG' ? 'h-auto' : 'max-h-[34dvh] object-contain md:max-h-80'}`}
          />
        )}

        <h2 className="text-center text-xl font-bold md:text-2xl">{card.prompt}</h2>

        {/* Botones grandes: minimo 56px de alto para uso tactil en la mesa */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((opt, i) => (
            <button
              key={opt}
              disabled={!!resolved}
              onClick={() => resolve({ kind: 'QUIZ', card, answer: opt })}
              className={`flex min-h-14 items-center gap-3 rounded-xl px-4 text-left text-lg font-semibold transition active:scale-[0.98] ${optionClass(opt)}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-black/10 font-stamp text-sm dark:bg-white/10">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
        </div>

        {resolved && player && (
          <CardResult result={resolved.result} playerName={player.name}>
            {!resolved.result.correct && (
              <p>
                Respuesta correcta: <strong>{card.correctAnswer}</strong>
              </p>
            )}
            {card.funFact && <p className="max-w-prose text-sm italic">💡 {card.funFact}</p>}
          </CardResult>
        )}
      </div>
    </Modal>
  );
}
