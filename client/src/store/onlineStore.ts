import { create } from 'zustand';
import type { GameStatePayload, OnlineAnswer, PublicGameView } from '@roampass/shared';
import { ApiError } from '../api';
import { emitAction, getSocket } from '../online/socket';

type Status = 'idle' | 'connecting' | 'ready' | 'error' | 'closed';

interface OnlineStore {
  sessionId: string | null;
  view: PublicGameView | null;
  /** userIds con la mesa abierta. */
  connected: string[];
  status: Status;
  error: string | null;
  /** El servidor esta desconectado (se reintenta solo). */
  offline: boolean;

  /** Abre la mesa: se une a la sala y recibe el estado. Vuelve a unirse al reconectar (9.4). */
  join: (sessionId: string) => void;
  leave: () => void;
  act: (event: Parameters<typeof emitAction>[0], extra?: Partial<OnlineAnswer>) => Promise<void>;
}

/**
 * Estado de la partida online que se esta mirando. No hay motor en el cliente (D4): solo la vista
 * que manda el servidor, que se reemplaza entera con cada cambio.
 */
export const useOnlineStore = create<OnlineStore>()((set, get) => {
  let unbind: (() => void) | null = null;

  const apply = (payload: GameStatePayload) => {
    if (payload.view.state.id !== get().sessionId) return;
    // Ignora estados viejos que lleguen desordenados.
    const current = get().view?.state.online.seq ?? -1;
    if (payload.view.state.online.seq < current) return;
    set({ view: payload.view, connected: payload.connected, status: 'ready', error: null });
  };

  return {
    sessionId: null,
    view: null,
    connected: [],
    status: 'idle',
    error: null,
    offline: false,

    join(sessionId) {
      get().leave();
      set({ sessionId, view: null, connected: [], status: 'connecting', error: null });
      const socket = getSocket();
      const doJoin = () =>
        socket.emit('game:join', { sessionId }, (res) => {
          if (get().sessionId !== sessionId) return;
          if (res.ok) apply(res);
          else set({ status: 'error', error: new ApiError(res.error, 0, res.code).message });
        });
      const onState = (p: GameStatePayload) => apply(p);
      const onClosed = ({ sessionId: id }: { sessionId: string }) => id === sessionId && set({ status: 'closed' });
      const onConnect = () => {
        set({ offline: false });
        doJoin();
      };
      const onDisconnect = () => set({ offline: true });
      socket.on('game:state', onState);
      socket.on('game:closed', onClosed);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (socket.connected) doJoin();
      unbind = () => {
        socket.off('game:state', onState);
        socket.off('game:closed', onClosed);
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.emit('game:leave', { sessionId });
      };
    },

    leave() {
      unbind?.();
      unbind = null;
      set({ sessionId: null, view: null, connected: [], status: 'idle', error: null });
    },

    async act(event, extra) {
      const sessionId = get().sessionId;
      if (!sessionId) return;
      await emitAction(event, { sessionId, ...extra } as never);
    },
  };
});
