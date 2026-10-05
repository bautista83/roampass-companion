import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { currentPlayer, remainingByCategory } from '@roampass/shared';
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { TurnBanner } from './TurnBanner';
import { Scoreboard } from './Scoreboard';
import { CardGrid } from './CardGrid';
import { QuizModal } from './QuizModal';
import { TravelEventModal } from './TravelEventModal';
import { VictoryScreen } from './VictoryScreen';

// Leaflet pesa ~150 kB: se descarga recien al robar la primera carta de LUGAR.
const LocationCardModal = lazy(() => import('./LocationCardModal').then((m) => ({ default: m.LocationCardModal })));

/**
 * Movil: 1 columna (turno sticky → mazo 2x3 → marcador).
 * Tablet horizontal (md+): 35% marcador/turno/ronda | 65% mazo.
 */
export function GameTable() {
  const game = useGameStore((s) => s.game);
  const active = useGameStore((s) => s.active);
  const syncError = useGameStore((s) => s.syncError);
  const deck = useGameStore((s) => s.deck);
  const ensureDeck = useGameStore((s) => s.ensureDeck);
  const draw = useGameStore((s) => s.draw);
  const endEarly = useGameStore((s) => s.endEarly);
  const navigate = useNavigate();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const usedCardIds = game?.usedCardIds;
  const remaining = useMemo(() => remainingByCategory(deck, usedCardIds ?? []), [deck, usedCardIds]);

  useEffect(() => {
    void ensureDeck();
  }, [ensureDeck]);

  if (!game) return <Navigate to="/" replace />;

  const finished = game.status === 'FINISHED';
  // Mientras se ve el resultado de la ultima carta, la victoria espera a que se cierre.
  const showVictory = finished && !active;

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)] md:grid-rows-[auto_auto_1fr] md:items-start md:gap-6">
      <TurnBanner game={game} player={currentPlayer(game)} className="sticky top-0 z-20 md:static md:col-start-1 md:row-start-1" />

      <section className="md:col-start-2 md:row-span-3 md:row-start-1" aria-label="Mazo de tarjetas">
        <CardGrid disabled={finished || !!active || deck.length === 0} remaining={remaining} onDraw={draw} />
        {syncError && (
          <p className="mt-3 rounded-lg bg-brass/15 px-3 py-2 text-xs text-passport-700 dark:text-passport-100">
            ⚠ Sin conexión con el servidor ({syncError}). La partida sigue guardada en este dispositivo.
          </p>
        )}
      </section>

      <aside className="md:col-start-1 md:row-start-2">
        <Scoreboard game={game} />
      </aside>

      <div className="flex gap-2 md:col-start-1 md:row-start-3">
        <button className="btn-ghost flex-1 text-sm" onClick={() => navigate('/')}>
          ⏸ Pausar
        </button>
        <button className="btn-ghost flex-1 text-sm text-stamp" onClick={() => setConfirmEnd(true)} disabled={finished}>
          🏁 Terminar ahora
        </button>
      </div>

      {active?.card.category === 'LOCATION' && (
        <Suspense fallback={null}>
          <LocationCardModal draw={active} />
        </Suspense>
      )}
      {active && 'options' in active.card && <QuizModal draw={active} />}
      {active?.card.category === 'TRAVEL_EVENT' && <TravelEventModal draw={active} />}

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
    </div>
  );
}
