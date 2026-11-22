import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BOARD, boardPosition, currentPlayer, remainingByCategory, type CardCategory, type GamePlayer } from '@roampass/shared';
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { TurnBanner } from './TurnBanner';
import { Scoreboard } from './Scoreboard';
import { CardGrid } from './CardGrid';
import { QuizModal } from './QuizModal';
import { TravelEventModal } from './TravelEventModal';
import { VictoryScreen } from './VictoryScreen';
import { BoardView } from './BoardView';
import { Die } from './Die';
import { RulesGuide } from '../rules/RulesGuide';

// Leaflet pesa ~150 kB: se descarga recien al robar la primera carta de LUGAR.
const LocationCardModal = lazy(() => import('./LocationCardModal').then((m) => ({ default: m.LocationCardModal })));

const TRANSPORT_ICON: Record<string, string> = {
  t_barco: '🚢',
  t_globo: '🎈',
  t_camello: '🐪',
  t_tren: '🚂',
  t_tuktuk: '🛺',
  t_combi: '🚐',
  t_avion: '✈️',
};

/** Pausa entre que la ficha queda quieta en el transporte y se abre el Evento de Viajero. */
const TRANSPORT_DELAY_MS = 1600;

/**
 * Mesa de juego. Cada turno: dado (o carta tocada en el tablero fisico) → carta → millas.
 * - Tablero fisico: mazo grande de 6 cartas; el peon se mueve en el tablero impreso.
 * - Tablero digital: el mapa en pantalla con las fichas que avanzan solas; las cartas las abre el dado.
 * Si el jugador cae en una casilla de transporte tras acertar, en el mismo turno se abre un Evento de Viajero.
 */
export function GameTable() {
  const game = useGameStore((s) => s.game);
  const active = useGameStore((s) => s.active);
  const syncError = useGameStore((s) => s.syncError);
  const deck = useGameStore((s) => s.deck);
  const ensureDeck = useGameStore((s) => s.ensureDeck);
  const draw = useGameStore((s) => s.draw);
  const skipTransport = useGameStore((s) => s.skipTransport);
  const endEarly = useGameStore((s) => s.endEarly);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [moving, setMoving] = useState(false);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const usedCardIds = game?.usedCardIds;
  const remaining = useMemo(() => remainingByCategory(deck, usedCardIds ?? []), [deck, usedCardIds]);

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() }), []);

  useEffect(() => {
    void ensureDeck();
  }, [ensureDeck]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  // Casilla de transporte: con la ficha ya quieta, se abre solo el Evento de Viajero del mismo turno.
  const transportPending = !!game && game.status === 'PLAYING' && !!game.transportEvent && !active;
  const eventsLeft = remaining.TRAVEL_EVENT;
  useEffect(() => {
    if (!transportPending || moving || !game || deck.length === 0) return;
    const space = BOARD.spaces[boardPosition(currentPlayer(game).score).space]!;
    showToast(t('game.table.transportToast', { icon: TRANSPORT_ICON[space.id] ?? '🧳', place: space.name }));
    const timer = setTimeout(() => {
      if (eventsLeft > 0) draw('TRAVEL_EVENT');
      else {
        showToast(t('game.table.noEventsToast'));
        skipTransport();
      }
    }, TRANSPORT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [transportPending, moving, deck.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // En el tablero digital la llegada se anuncia con el lugar destacado sobre el mapa.
  const onArrive = useCallback((_player: GamePlayer, _steps: number) => {}, []);

  if (!game) return <Navigate to="/" replace />;

  const digital = game.config.board === 'DIGITAL';
  const finished = game.status === 'FINISHED';
  const player = currentPlayer(game);
  // Mientras se ve el resultado de la ultima carta (o viaja la ficha), la victoria espera.
  const showVictory = finished && !active && !moving;
  const locked = finished || !!active || deck.length === 0 || moving || !!game.transportEvent;
  const available = (c: CardCategory) => remaining[c] > 0;

  const dieHint = game.transportEvent
    ? t('game.table.dieHintTransport')
    : digital
      ? t('game.table.dieHintDigital', { name: player.name })
      : t('game.table.dieHintPhysical');

  const diePanel = (
    <div className="panel flex items-center justify-center gap-4 p-3 md:p-4">
      <Die disabled={locked} available={available} onRolled={draw} hint={dieHint} />
    </div>
  );

  const buttons = (
    <div className="flex gap-2">
      <button className="btn-ghost flex-1 text-sm" onClick={() => navigate('/')}>
        {t('game.table.pause')}
      </button>
      <button className="btn-ghost w-14 shrink-0 px-0 text-sm" onClick={() => setShowRules(true)} aria-label={t('game.table.rulesAria')} title={t('game.table.rulesTitle')}>
        ❓
      </button>
      <button className="btn-ghost flex-1 text-sm text-stamp" onClick={() => setConfirmEnd(true)} disabled={finished}>
        {t('game.table.endNow')}
      </button>
    </div>
  );

  const syncWarning = syncError && (
    <p className="mt-3 rounded-xl border-2 border-ink bg-sun px-3 py-2 text-xs font-semibold text-ink">
      {t('game.table.syncWarning', { error: syncError })}
    </p>
  );

  return (
    <>
      {digital ? (
        // Movil: turno → tablero → dado → cartas → marcador. Tablet: columna de control | tablero.
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,30fr)_minmax(0,70fr)] md:items-start md:gap-5">
          <div className="contents md:flex md:flex-col md:gap-4">
            <TurnBanner game={game} player={player} className="sticky top-[var(--sat)] z-40 order-1 md:static md:order-none" />
            <div className="order-3 md:order-none">{diePanel}</div>
            <aside className="order-5 md:order-none">
              <Scoreboard game={game} />
            </aside>
            <div className="order-6 md:order-none">{buttons}</div>
          </div>
          <div className="contents md:flex md:flex-col md:gap-4">
            <section className="order-2 md:order-none" aria-label={t('game.table.boardAria')}>
              <BoardView
                players={game.players}
                config={game.config}
                currentPlayerId={finished ? null : player.id}
                frozen={!!active}
                onArrive={onArrive}
                onMovingChange={setMoving}
              />
            </section>
            <section className="order-4 md:order-none" aria-label={t('game.table.dieCardsAria')}>
              <CardGrid compact disabled remaining={remaining} onDraw={draw} />
              {syncWarning}
            </section>
          </div>
        </div>
      ) : (
        // Movil: 1 columna (turno sticky → dado → mazo 2x3 → marcador). Tablet: 35% control | 65% mazo.
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] md:grid-rows-[auto_auto_auto_1fr] md:items-start md:gap-6">
          <TurnBanner game={game} player={player} className="sticky top-[var(--sat)] z-20 md:static md:col-start-1 md:row-start-1" />
          <div className="md:col-start-1 md:row-start-2">{diePanel}</div>
          <section className="md:col-start-2 md:row-span-4 md:row-start-1" aria-label={t('game.table.deckAria')}>
            <CardGrid disabled={locked} remaining={remaining} onDraw={draw} />
            {syncWarning}
          </section>
          <aside className="md:col-start-1 md:row-start-3">
            <Scoreboard game={game} />
          </aside>
          <div className="md:col-start-1 md:row-start-4">{buttons}</div>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            role="status"
            className="sticker fixed top-[calc(5rem+var(--sat))] left-1/2 z-[900] max-w-[92vw] -translate-x-1/2 bg-sun px-4 py-2 text-center text-sm font-extrabold text-ink md:text-base"
            initial={{ y: -30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {active?.card.category === 'LOCATION' && (
        <Suspense fallback={null}>
          <LocationCardModal draw={active} />
        </Suspense>
      )}
      {active && 'options' in active.card && <QuizModal draw={active} />}
      {active?.card.category === 'TRAVEL_EVENT' && <TravelEventModal draw={active} />}

      {/* Reglas sin salir de la partida: no hay carta abierta, asi que ningun reloj corre mientras se leen. */}
      <Modal open={showRules} onClose={() => setShowRules(false)} title={t('game.table.howToPlay')} size="xl">
        <div className="p-4 md:p-6">
          <RulesGuide onFinish={() => setShowRules(false)} />
        </div>
      </Modal>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title={t('game.table.endTitle')}>
        <div className="space-y-4 p-6">
          <p>{t('game.table.endBody')}</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmEnd(false)}>
              {t('game.table.keepPlaying')}
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                endEarly();
                setConfirmEnd(false);
              }}
            >
              {t('game.table.end')}
            </button>
          </div>
        </div>
      </Modal>

      {showVictory && <VictoryScreen game={game} />}
    </>
  );
}
