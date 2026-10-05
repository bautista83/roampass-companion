// Estado de la mesa de juego. Envuelve el motor puro de @roampass/shared y lo persiste en
// localStorage: refrescar el navegador (o que se apague la tablet) no pierde la partida,
// ni siquiera con una carta abierta a medio responder.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyTurn,
  createGame,
  drawCard,
  finish,
  generateCountryCards,
  shuffle,
  type Card,
  type CardCategory,
  type CardOutcome,
  type CountryData,
  type GameState,
  type LatLng,
  type PlayerSetup,
  type ScoreResult,
  type SeedData,
  type VictoryCondition,
} from '@roampass/shared';
import seed from '@roampass/shared/seedData.json';
import countries from '@roampass/shared/countries.json';
import { api } from '../api';

export interface ActiveDraw {
  card: Card;
  /** Opciones ya mezcladas (se guardan para que no cambien al refrescar). */
  options?: string[];
  playerId: string;
  resolved?: { result: ScoreResult; answer?: string; guess?: LatLng };
}

interface GameStore {
  game: GameState | null;
  selfPlayerId: string | null;
  deck: Card[];
  active: ActiveDraw | null;
  syncError: string | null;

  startGame: (config: VictoryCondition, players: PlayerSetup[], selfIndex: number | null) => Promise<void>;
  resumeGame: (state: GameState) => Promise<void>;
  /** Recarga el mazo si falta (p. ej. tras actualizar la app con una partida en curso). */
  ensureDeck: () => Promise<void>;
  draw: (category: CardCategory) => void;
  resolve: (outcome: CardOutcome) => ScoreResult;
  dismissCard: () => void;
  endEarly: () => void;
  clear: () => void;
}

/** Cartas escritas a mano (backend o seed incluido) + banderas y capitales generadas localmente. */
async function loadDeck(): Promise<Card[]> {
  let base = (seed as SeedData).cards;
  try {
    const cards = await api.getCards();
    if (cards.length > 0) base = cards;
  } catch {
    // backend caido: se juega con el mazo incluido en la app
  }
  return [...base, ...generateCountryCards(countries as CountryData, base)];
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const sync = () => {
        const { game, selfPlayerId } = get();
        if (!game) return;
        api
          .saveGame(game, selfPlayerId)
          .then(() => set({ syncError: null }))
          .catch((err: Error) => set({ syncError: err.message }));
      };

      return {
        game: null,
        selfPlayerId: null,
        deck: [],
        active: null,
        syncError: null,

        async startGame(config, players, selfIndex) {
          const deck = await loadDeck();
          const game = createGame(config, players);
          const selfPlayerId = selfIndex === null ? null : (game.players[selfIndex]?.id ?? null);
          set({ game, deck, selfPlayerId, active: null, syncError: null });
          sync();
        },

        async resumeGame(state) {
          set({ game: state, deck: await loadDeck(), active: null });
        },

        async ensureDeck() {
          if (get().deck.length === 0) set({ deck: await loadDeck() });
        },

        draw(category) {
          const { game, deck, active } = get();
          if (!game || game.status !== 'PLAYING' || active) return;
          const card = drawCard(deck, category, game.usedCardIds);
          if (!card) return; // categoria agotada: la tarjeta ya se muestra bloqueada
          const player = game.players[game.currentPlayerIndex]!;
          set({ active: { card, playerId: player.id, options: 'options' in card ? shuffle(card.options) : undefined } });
        },

        resolve(outcome) {
          const { game, active } = get();
          if (!game || !active || active.resolved) throw new Error('No hay carta pendiente');
          const { state, result } = applyTurn(game, outcome);
          set({
            game: state,
            active: {
              ...active,
              resolved: {
                result,
                ...(outcome.kind === 'QUIZ' && { answer: outcome.answer }),
                ...(outcome.kind === 'LOCATION' && { guess: outcome.guess }),
              },
            },
          });
          sync();
          return result;
        },

        dismissCard() {
          if (get().active?.resolved) set({ active: null });
        },

        endEarly() {
          const { game } = get();
          if (!game) return;
          set({ game: finish(game), active: null });
          sync();
        },

        clear() {
          set({ game: null, active: null, selfPlayerId: null, syncError: null });
        },
      };
    },
    {
      name: 'roampass-game',
      // v2: las cartas tienen dificultad. Un mazo guardado de v1 se descarta (la partida se conserva)
      // y GameTable lo vuelve a cargar con ensureDeck().
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Pick<GameStore, 'game' | 'selfPlayerId' | 'deck' | 'active'>;
        return version < 2 ? { ...state, deck: [], active: null } : state;
      },
      partialize: ({ game, selfPlayerId, deck, active }) => ({ game, selfPlayerId, deck, active }),
    },
  ),
);
