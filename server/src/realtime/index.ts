import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server, type Socket } from 'socket.io';
import {
  GameRuleError,
  hostEnd,
  hostPause,
  hostResume,
  leaveLobby,
  passTurn,
  roll,
  setPresence,
  startOnlineGame,
  submitAnswer,
  toPublicView,
  type Ack,
  type ClientToServerEvents,
  type GameStatePayload,
  type OnlineAnswer,
  type OnlineGameState,
  type ServerToClientEvents,
} from '@roampass/shared';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../http';
import { publicUserSelect, type PublicUser } from '../auth/middleware';
import { onlineDeck } from '../online/deck';
import { setLookingChecker, setUserEmitter } from '../online/notify';
import { cancelPendingInvites } from '../online/routes';
import { onlineService } from '../online/service';
import { loadOnline } from '../online/store';

interface SocketData {
  user: PublicUser;
  /** Partidas que tiene abiertas esta conexion. */
  games: Set<string>;
  /** La app esta en primer plano (client:visibility). Sin ese evento, se asume que si. */
  visible: boolean;
}
type RoamleSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const room = (sessionId: string) => `game:${sessionId}`;
const userRoom = (userId: string) => `user:${userId}`;

/** Traduce cualquier error al formato de la API ({ error, code, params }). */
function toAckError(err: unknown): Ack {
  if (err instanceof HttpError) return { ok: false, error: err.message, ...(err.code && { code: err.code }) };
  if (err instanceof GameRuleError) return { ok: false, error: err.message, code: err.code ?? 'GAME_RULE', ...(err.params && { params: err.params }) };
  console.error('Error en una accion online:', err);
  return { ok: false, error: 'Error interno', code: 'INTERNAL' };
}

export function attachRealtime(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins },
  });

  /** userIds conectados a cada partida (para el indicador "conectado"). */
  const connectedIn = (sessionId: string) => {
    const ids = new Set<string>();
    for (const id of io.sockets.adapter.rooms.get(room(sessionId)) ?? []) {
      const s = io.sockets.sockets.get(id) as RoamleSocket | undefined;
      if (s) ids.add(s.data.user.id);
    }
    return [...ids];
  };

  /** Cada usuario recibe su propia vista (D: la carta pendiente depende de quien mira). */
  async function broadcast(state: OnlineGameState) {
    const deck = await onlineDeck();
    const connected = connectedIn(state.id);
    for (const id of io.sockets.adapter.rooms.get(room(state.id)) ?? []) {
      const s = io.sockets.sockets.get(id) as RoamleSocket | undefined;
      if (s) s.emit('game:state', { view: toPublicView(state, deck, s.data.user.id), connected });
    }
  }

  onlineService.onChange((state) => void broadcast(state));
  onlineService.onClosed((sessionId) => {
    io.to(room(sessionId)).emit('game:closed', { sessionId, reason: 'CANCELLED' });
    io.in(room(sessionId)).socketsLeave(room(sessionId));
  });
  setUserEmitter((userId, event, ...args) => {
    // El tipo de cada evento ya lo controla `notifyUser`; aca solo se reenvia.
    (io.to(userRoom(userId)).emit as (ev: string, ...a: unknown[]) => boolean)(event, ...args);
  });
  setLookingChecker((userId) => {
    for (const id of io.sockets.adapter.rooms.get(userRoom(userId)) ?? []) {
      const s = io.sockets.sockets.get(id) as RoamleSocket | undefined;
      if (s?.data.visible) return true;
    }
    return false;
  });

  // Autenticacion en el handshake con el mismo JWT de la API.
  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
      if (!token) throw new Error('sin token');
      const userId = String(jwt.verify(token, env.jwtSecret).sub);
      const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
      if (!user || !user.isActive) throw new Error('cuenta inactiva');
      socket.data.user = user;
      socket.data.games = new Set();
      socket.data.visible = true;
      next();
    } catch {
      next(new Error('SESSION_INVALID'));
    }
  });

  io.on('connection', (socket: RoamleSocket) => {
    const userId = socket.data.user.id;
    void socket.join(userRoom(userId));

    socket.on('client:visibility', (payload) => {
      socket.data.visible = payload?.visible !== false;
    });

    /** Ejecuta una accion de juego y responde por el ack. */
    const action =
      (fn: (s: OnlineGameState, deck: Awaited<ReturnType<typeof onlineDeck>>) => OnlineGameState, after?: (s: OnlineGameState) => Promise<void>) =>
      async (payload: { sessionId: string }, ack: (res: Ack) => void) => {
        try {
          const next = await onlineService.act(payload.sessionId, fn);
          if (after) await after(next);
          ack?.({ ok: true });
        } catch (err) {
          ack?.(toAckError(err));
        }
      };

    socket.on('game:join', async ({ sessionId }, ack) => {
      try {
        const { state } = await loadOnline(sessionId);
        if (!state.online.userIds.includes(userId)) throw new HttpError(403, 'No participas en esta partida', 'NOT_IN_GAME');
        await socket.join(room(sessionId));
        socket.data.games.add(sessionId);
        const deck = await onlineDeck();
        const payload: GameStatePayload = { view: toPublicView(state, deck, userId), connected: connectedIn(sessionId) };
        ack?.({ ok: true, ...payload });
        // Los demas ven que se conecto.
        void broadcast(state);
      } catch (err) {
        ack?.(toAckError(err) as Ack<GameStatePayload>);
      }
    });

    socket.on('game:leave', ({ sessionId }) => {
      void socket.leave(room(sessionId));
      socket.data.games.delete(sessionId);
      loadOnline(sessionId).then(({ state }) => broadcast(state)).catch(() => {});
    });

    socket.on(
      'game:start',
      action(
        (s) => startOnlineGame(s, userId),
        (s) => cancelPendingInvites(s.id, socket.data.user.username),
      ),
    );
    socket.on('game:roll', action((s, deck) => roll(s, deck, userId)));
    socket.on('game:pass', action((s) => passTurn(s, userId)));
    socket.on('game:answer', (payload, ack) => {
      const answer: OnlineAnswer =
        'guess' in payload
          ? { guess: { lat: Number(payload.guess?.lat), lng: Number(payload.guess?.lng) } }
          : { answer: String((payload as { answer?: unknown }).answer ?? '') };
      void action((s, deck) => submitAnswer(s, deck, userId, answer))(payload, ack);
    });
    socket.on('lobby:leave', action((s) => leaveLobby(s, userId)));
    socket.on('player:pause', action((s, deck) => setPresence(s, deck, userId, 'PAUSED')));
    socket.on('player:resume', action((s, deck) => setPresence(s, deck, userId, 'ACTIVE')));
    socket.on('player:abandon', action((s, deck) => setPresence(s, deck, userId, 'ABANDONED')));
    socket.on('host:pause', action((s) => hostPause(s, userId)));
    socket.on('host:resume', action((s) => hostResume(s, userId)));
    socket.on('host:end', action((s) => hostEnd(s, userId)));

    // Al desconectarse, los demas lo ven desconectado (no pausa nada: 9.4).
    socket.on('disconnect', () => {
      for (const sessionId of socket.data.games) {
        loadOnline(sessionId).then(({ state }) => broadcast(state)).catch(() => {});
      }
    });
  });

  return io;
}
