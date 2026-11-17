import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Casilla de transporte: con la ficha ya quieta, se abre solo el Evento de Viajero del mismo turno.
  const transportPending = !!game && game.status === 'PLAYING' && !!game.transportEvent && !active;
  const eventsLeft = remaining.TRAVEL_EVENT;
  useEffect(() => {
    if (!transportPending || moving || !game || deck.length === 0) return;
    const space = BOARD.spaces[boardPosition(currentPlayer(game).score).space]!;
    showToast(`${TRANSPORT_ICON[space.id] ?? '🧳'} ¡${space.name}! Te toca un Evento de Viajero`);
    const t = setTimeout(() => {
      if (eventsLeft > 0) draw('TRAVEL_EVENT');
      else {
        showToast('No quedan Eventos de Viajero: la ficha se queda en el transporte');
        skipTransport();
      }
    }, TRANSPORT_DELAY_MS);
    return () => clearTimeout(t);
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
    ? 'Casilla de transporte: Evento de Viajero'
    : digital
      ? `Tocá el dado, ${player.name}`
      : 'Tocá el dado o tirá el dado físico y elegí la carta';

  const diePanel = (
    <div className="panel flex items-center justify-center gap-4 p-3 md:p-4">
      <Die disabled={locked} available={available} onRolled={draw} hint={dieHint} />
    </div>
  );

  const buttons = (
    <div className="flex gap-2">
      <button className="btn-ghost flex-1 text-sm" onClick={() => navigate('/')}>
        ⏸ Pausar
      </button>
      <button className="btn-ghost w-14 shrink-0 px-0 text-sm" onClick={() => setShowRules(true)} aria-label="Ver las reglas del juego" title="Reglas del juego">
        ❓
      </button>
      <button className="btn-ghost flex-1 text-sm text-stamp" onClick={() => setConfirmEnd(true)} disabled={finished}>
        🏁 Terminar ahora
      </button>
    </div>
  );

  const syncWarning = syncError && (
    <p className="mt-3 rounded-xl border-2 border-ink bg-sun px-3 py-2 text-xs font-semibold text-ink">
      ⚠ Sin conexión con el servidor ({syncError}). La partida sigue guardada en este dispositivo.
    </p>
  );

  return (
    <>
      {digital ? (
        // Movil: turno → tablero → dado → cartas → marcador. Tablet: columna de control | tablero.
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,30fr)_minmax(0,70fr)] md:items-start md:gap-5">
          <div className="contents md:flex md:flex-col md:gap-4">
            <TurnBanner game={game} player={player} className="sticky top-0 z-40 order-1 md:static md:order-none" />
            <div className="order-3 md:order-none">{diePanel}</div>
            <aside className="order-5 md:order-none">
              <Scoreboard game={game} />
            </aside>
            <div className="order-6 md:order-none">{buttons}</div>
          </div>
          <div className="contents md:flex md:flex-col md:gap-4">
            <section className="order-2 md:order-none" aria-label="Tablero">
              <BoardView
                players={game.players}
                currentPlayerId={finished ? null : player.id}
                frozen={!!active}
                onArrive={onArrive}
                onMovingChange={setMoving}
              />
            </section>
            <section className="order-4 md:order-none" aria-label="Cartas del dado">
              <CardGrid compact disabled remaining={remaining} onDraw={draw} />
              {syncWarning}
            </section>
          </div>
        </div>
      ) : (
        // Movil: 1 columna (turno sticky → dado → mazo 2x3 → marcador). Tablet: 35% control | 65% mazo.
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] md:grid-rows-[auto_auto_auto_1fr] md:items-start md:gap-6">
          <TurnBanner game={game} player={player} className="sticky top-0 z-20 md:static md:col-start-1 md:row-start-1" />
          <div className="md:col-start-1 md:row-start-2">{diePanel}</div>
          <section className="md:col-start-2 md:row-span-4 md:row-start-1" aria-label="Mazo de tarjetas">
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
            className="sticker fixed top-20 left-1/2 z-[900] max-w-[92vw] -translate-x-1/2 bg-sun px-4 py-2 text-center text-sm font-extrabold text-ink md:text-base"
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
      <Modal open={showRules} onClose={() => setShowRules(false)} title="📖 Cómo jugar" size="xl">
        <div className="p-4 md:p-6">
          <RulesGuide onFinish={() => setShowRules(false)} />
        </div>
      </Modal>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Terminar partida">
        <div className="space-y-4 p-6">
          <p>Se cerrará la partida ahora y ganará quien vaya primero en el marcador. ¿Continuar?</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmEnd(false)}>
              Seguir jugando
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                endEarly();
                setConfirmEnd(false);
              }}
            >
              Terminar
            </button>
          </div>
        </div>
      </Modal>

      {showVictory && <VictoryScreen game={game} />}
    </>
  );
}
