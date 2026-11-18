import { QUIZ_POINTS, flagUrl, withDifficulty, type QuizCard } from '@roampass/shared';
import { Trans, useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';
import { useGameStore, type ActiveDraw } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { CardImage } from '../ui/CardImage';
import { DifficultyBadge } from '../ui/DifficultyBadge';
import { CardTimer } from '../ui/CardTimer';
import { useCardTimer } from '../../hooks/useCountdown';
import { CardResult } from './CardResult';

/** Cartas de seleccion multiple: BANDERA, CAPITALES Y CIUDADES, HISTORIA y PERSONALIDADES. */
export function QuizModal({ draw }: { draw: ActiveDraw }) {
  const card = draw.card as QuizCard;
  const resolve = useGameStore((s) => s.resolve);
  const player = useGameStore((s) => s.game?.players.find((p) => p.id === draw.playerId));
  const { t } = useTranslation();
  const { categories, miles } = useLabels();
  const meta = categories[card.category];
  const resolved = draw.resolved;
  const image = card.category === 'FLAG' && card.countryCode ? flagUrl(card.countryCode, 640) : card.imageUrl;
  const options = draw.options ?? card.options;
  // Si se acaba el tiempo sin respuesta, cuenta como error.
  const timer = useCardTimer(draw, () => resolve({ kind: 'TIMEOUT', card }));

  const optionClass = (opt: string) => {
    if (!resolved) return 'bg-white hover:-translate-y-0.5 hover:bg-sun/40 dark:bg-[#2a2f2a]';
    if (opt === card.correctAnswer) return 'bg-mint text-ink';
    if (opt === resolved.answer) return 'bg-coral text-ink';
    return 'opacity-40 bg-white dark:bg-[#2a2f2a]';
  };

  return (
    <Modal
      open
      flip
      title={
        <span className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <span>{meta.label}</span>
          <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold text-ink">
            +{miles(withDifficulty(QUIZ_POINTS[card.category], card.difficulty))}
          </span>
          <DifficultyBadge difficulty={card.difficulty} />
          {timer.hasTimer && (
            <span className="ml-auto">
              <CardTimer remainingMs={timer.remainingMs} totalSeconds={timer.totalSeconds} stopped={timer.stopped} timedOut={timer.timedOut} />
            </span>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <p className="text-sm text-passport-500 dark:text-passport-300">
          <Trans
            i18nKey="game.quiz.turnOf"
            values={{ player: `${player?.avatar ?? ''} ${player?.name ?? ''}` }}
            components={{ b: <strong className="text-passport-900 dark:text-white" /> }}
          />
        </p>

        {image && (
          <CardImage
            src={image}
            alt={card.category === 'FLAG' ? t('game.quiz.mysteryFlag') : card.prompt}
            credit={card.credit}
            className={`mx-auto w-full rounded-xl ${card.category === 'FLAG' ? 'max-w-sm border-3 border-ink bg-transparent shadow-hard' : 'max-w-md border-3 border-ink shadow-hard'}`}
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
              className={`sticker flex min-h-14 items-center gap-3 px-4 text-left text-lg font-bold shadow-hard-sm transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${optionClass(opt)}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun font-stamp text-sm text-ink">
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
                <Trans i18nKey="game.quiz.correctAnswer" values={{ answer: card.correctAnswer }} components={{ b: <strong /> }} />
              </p>
            )}
            {card.funFact && <p className="max-w-prose text-sm italic">💡 {card.funFact}</p>}
          </CardResult>
        )}
      </div>
    </Modal>
  );
}
