import { lazy, Suspense, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ANSWER_GRACE_MS,
  LOCATION_BRACKETS,
  QUIZ_POINTS,
  flagUrl,
  withDifficulty,
  type Card,
  type LatLng,
  type PublicCard,
  type PublicGameView,
} from '@roampass/shared';
import { api } from '../../api';
import { errorText } from '../../i18n';
import { useLabels } from '../../i18n/useLabels';
import { useOnlineStore } from '../../store/onlineStore';
import { StreetViewFrame } from '../game/LocationCardModal';
import { CardImage } from '../ui/CardImage';
import { CardTimer } from '../ui/CardTimer';
import { DifficultyBadge } from '../ui/DifficultyBadge';
import { Modal } from '../ui/Modal';

const OnlineLocationMap = lazy(() => import('./OnlineLocationMap'));

/** Milisegundos que faltan para responder (sin el margen de latencia del servidor). */
function useRemainingMs(deadline: string | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);
  if (!deadline) return 0;
  return Math.max(0, new Date(deadline).getTime() - ANSWER_GRACE_MS - now);
}

/**
 * Carta de la partida online: el jugador activo responde; los demas la ven en solo lectura.
 * Mientras se responde viene la carta publica (sin respuesta); al resolverse, la completa (7.3).
 */
export function OnlineCard({ view }: { view: PublicGameView }) {
  const { t } = useTranslation();
  const { categories, miles, num } = useLabels();
  const act = useOnlineStore((s) => s.act);
  const { state, pending, you } = view;
  const phase = state.online.phase;
  const resolution = state.online.lastResolution;
  const answering = phase === 'AWAITING_ANSWER' && pending;
  const showing = (phase === 'SHOWING_RESULT' || state.status === 'FINISHED') && resolution?.card;
  const card: PublicCard | Card | undefined = answering ? pending.card : showing ? resolution.card : undefined;
  const player = state.players.find((p) => p.id === (answering ? state.players[state.currentPlayerIndex]!.id : resolution?.playerId));
  const remainingMs = useRemainingMs(state.online.deadline, !!answering && !state.online.pausedByHost);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spectatorPhoto, setSpectatorPhoto] = useState<string | null>(null);
  const cardId = card?.id;

  useEffect(() => {
    setGuess(null);
    setError(null);
  }, [cardId]);

  // Espectador de una carta Street View: foto fija servida por el servidor (sin coordenadas).
  const wantsPhoto = !!answering && 'spectatorPhoto' in pending.card && pending.card.spectatorPhoto === true;
  useEffect(() => {
    if (!wantsPhoto) return;
    let url: string | null = null;
    api.getStreetViewPhoto(state.id).then((u) => {
      url = u;
      setSpectatorPhoto(u);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
      setSpectatorPhoto(null);
    };
  }, [wantsPhoto, state.id, cardId]);

  // El modal de resultado de eventos de viajero tambien se muestra (no tienen pregunta).
  if (!card || !player || (!answering && !showing)) return null;
  if (state.status === 'FINISHED' && phase === 'FINISHED') return null;

  const meta = categories[card.category];
  const canAnswer = !!answering && you.isActive && !state.online.pausedByHost;

  async function answer(extra: { answer: string } | { guess: LatLng }) {
    setError(null);
    try {
      await act('game:answer', extra);
    } catch (err) {
      setError(errorText(err));
    }
  }

  const header = (
    <span className="flex items-center gap-2">
      <span className="text-2xl">{meta.icon}</span>
      <span>{meta.label}</span>
      {'difficulty' in card && <DifficultyBadge difficulty={card.difficulty} />}
      <span className="truncate text-sm font-normal text-passport-500 dark:text-passport-300">
        · {player.avatar} {player.name}
      </span>
      {answering && (
        <span className="ml-auto">
          <CardTimer remainingMs={remainingMs} totalSeconds={state.timerSeconds ?? 10} stopped={false} timedOut={false} />
        </span>
      )}
    </span>
  );

  const result = showing ? resolution.result : undefined;
  const resultBox = result && (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className={`stamp text-2xl ${result.delta > 0 ? 'border-stamp-green text-stamp-green' : 'border-stamp text-stamp'}`}>
        {result.timedOut ? t('game.result.timeout') : result.correct === null ? (result.delta > 0 ? t('game.result.bonus') : t('game.result.penalty')) : result.correct ? t('game.result.approved') : t('game.result.denied')}
        <span className="block text-3xl">
          {result.delta > 0 ? '+' : ''}
          {miles(result.delta)}
        </span>
      </span>
      {resolution?.transport && 'card' in resolution.transport && (
        <p className="text-sm font-semibold">
          {t('online.table.transportEvent', { title: resolution.transport.card.title, miles: miles(resolution.transport.result.delta) })}
        </p>
      )}
    </div>
  );

  // ── Evento de viajero (solo resultado) ──
  if (card.category === 'TRAVEL_EVENT') {
    return (
      <Modal open flip title={header}>
        <div className="flex flex-col items-center gap-4 p-6 text-center md:p-8">
          <span className="text-7xl" aria-hidden>
            {card.icon}
          </span>
          <h2 className="font-stamp text-3xl tracking-wider uppercase">{card.title}</h2>
          <p className="max-w-md text-lg">{card.description}</p>
          {resultBox}
        </div>
      </Modal>
    );
  }

  // ── LUGAR ──
  if (card.category === 'LOCATION') {
    const full = showing ? (resolution.card as Extract<Card, { category: 'LOCATION' }>) : null;
    const streetLocation = answering && 'location' in pending.card ? pending.card.location : undefined;
    const shownGuess = showing ? (resolution.guess ?? null) : guess;
    return (
      <Modal open flip size="xl" title={header}>
        <div className="flex h-full flex-col md:grid md:h-[78dvh] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="flex h-[34dvh] shrink-0 flex-col md:h-full">
            {card.imageUrl ? (
              <CardImage src={card.imageUrl} alt={t('game.location.photoAlt')} credit={card.credit} className="min-h-0 flex-1" imgClassName="h-full w-full object-cover" />
            ) : streetLocation ? (
              <StreetViewFrame location={streetLocation} />
            ) : spectatorPhoto ? (
              <img src={spectatorPhoto} alt={t('online.table.spectatorPhotoAlt')} className="min-h-0 w-full flex-1 object-cover" />
            ) : (
              <div className="grid flex-1 place-items-center bg-passport-800/10 p-6 text-center text-sm">📍 {card.prompt}</div>
            )}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {(canAnswer || showing) && (
              <div className="relative min-h-[34dvh] flex-1">
                <Suspense fallback={null}>
                  <OnlineLocationMap canPick={canAnswer} guess={shownGuess} target={full?.location} onPick={setGuess} />
                </Suspense>
              </div>
            )}
            <div className="shrink-0 border-t border-passport-800/10 p-3 md:p-4 dark:border-white/10">
              {showing && full ? (
                <div className="space-y-2 text-center">
                  <p className="text-lg">
                    📍 <strong>{full.answerLabel}</strong>
                    <br />
                    {result?.distanceKm === undefined ? (
                      t('game.location.noGuess')
                    ) : (
                      <Trans i18nKey="game.location.distance" values={{ km: `${num(Math.round(result.distanceKm))} km` }} components={{ b: <strong /> }} />
                    )}
                  </p>
                  {resultBox}
                </div>
              ) : canAnswer ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-passport-500 dark:text-passport-300">
                    {guess ? t('game.location.sure') : card.imageUrl ? t('game.location.tapPhoto') : t('game.location.tapStreetView')}
                    <span className="block text-xs">
                      {LOCATION_BRACKETS.map((b) => t('game.location.bracket', { km: num(b.maxKm), miles: miles(withDifficulty(b.points, card.difficulty)) })).join(' · ')}
                    </span>
                  </p>
                  <button className="btn-primary shrink-0 text-lg" disabled={!guess} onClick={() => guess && answer({ guess })}>
                    {t('game.location.confirm')}
                  </button>
                </div>
              ) : (
                <p className="text-center font-semibold">{t('online.table.spectatorWait', { name: player.name })}</p>
              )}
              {error && <p className="mt-2 text-sm font-bold text-stamp">{error}</p>}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Preguntas (bandera, ciudades, historia, personalidades) ──
  const quiz = card as Extract<Card | PublicCard, { options: string[] }>;
  const options = answering ? (pending.options ?? quiz.options) : quiz.options;
  const correct = showing ? (resolution.card as Extract<Card, { options: string[] }>).correctAnswer : undefined;
  const chosen = showing ? resolution.answer : undefined;
  const image = quiz.category === 'FLAG' && quiz.countryCode ? flagUrl(quiz.countryCode, 640) : quiz.imageUrl;
  const optionClass = (opt: string) => {
    if (!showing) return canAnswer ? 'bg-white hover:-translate-y-0.5 hover:bg-sun/40 dark:bg-[#2a2f2a]' : 'bg-white opacity-80 dark:bg-[#2a2f2a]';
    if (opt === correct) return 'bg-mint text-ink';
    if (opt === chosen) return 'bg-coral text-ink';
    return 'opacity-40 bg-white dark:bg-[#2a2f2a]';
  };
  return (
    <Modal
      open
      flip
      title={
        <span className="flex items-center gap-2">
          {header}
          <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold text-ink">
            +{miles(withDifficulty(QUIZ_POINTS[quiz.category as keyof typeof QUIZ_POINTS], quiz.difficulty))}
          </span>
        </span>
      }
    >
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {image && (
          <CardImage
            src={image}
            alt={quiz.category === 'FLAG' ? t('game.quiz.mysteryFlag') : quiz.prompt}
            credit={quiz.credit}
            className="mx-auto w-full max-w-sm rounded-xl border-3 border-ink shadow-hard"
            imgClassName="mx-auto max-h-[30dvh] w-full object-contain"
          />
        )}
        <h2 className="text-center text-xl font-bold md:text-2xl">{quiz.prompt}</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((opt, i) => (
            <button
              key={opt}
              disabled={!canAnswer}
              onClick={() => answer({ answer: opt })}
              className={`sticker flex min-h-14 items-center gap-3 px-4 text-left text-lg font-bold shadow-hard-sm transition ${optionClass(opt)}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun font-stamp text-sm text-ink">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>
        {!showing && !canAnswer && <p className="text-center font-semibold">{t('online.table.spectatorWait', { name: player.name })}</p>}
        {showing && (
          <>
            {result && !result.correct && correct && (
              <p className="text-center">
                <Trans i18nKey="game.quiz.correctAnswer" values={{ answer: correct }} components={{ b: <strong /> }} />
              </p>
            )}
            {'funFact' in resolution.card! && resolution.card.funFact && <p className="text-center text-sm italic">💡 {resolution.card.funFact}</p>}
            {resultBox}
          </>
        )}
        {error && <p className="text-center text-sm font-bold text-stamp">{error}</p>}
      </div>
    </Modal>
  );
}
