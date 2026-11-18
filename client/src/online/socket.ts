import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@roampass/shared';
import { ApiError } from '../api';
import { useAuthStore } from '../store/authStore';

export type RoamleSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Origen del servidor: el de VITE_API_URL (http://localhost:4000/api) o el mismo sitio (/api). */
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
export const onlineAvailable = Boolean(apiUrl);
const serverOrigin = () => new URL(apiUrl ?? '/', window.location.href).origin;

let socket: RoamleSocket | null = null;
let socketToken: string | null = null;

/** Conexion unica de tiempo real, autenticada con el token de la sesion. Se reconecta sola. */
export function getSocket(): RoamleSocket {
  const token = useAuthStore.getState().token;
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  socket = io(serverOrigin(), { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

// Al cerrar sesion se corta la conexion.
useAuthStore.subscribe((s, prev) => {
  if (prev.token && !s.token) closeSocket();
});

type ActionEvent = Exclude<keyof ClientToServerEvents, 'game:leave' | 'game:join'>;

/** Emite una accion y espera la respuesta; si el servidor la rechaza, lanza ApiError (traducido). */
export function emitAction(event: ActionEvent, payload: Parameters<ClientToServerEvents[ActionEvent]>[0]): Promise<void> {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new ApiError('Sin respuesta del servidor', 0, 'NETWORK')), 10_000);
    (s.emit as (ev: string, p: unknown, ack: (res: Ack) => void) => void)(event, payload, (res: Ack) => {
      clearTimeout(timeout);
      if (res.ok) resolve();
      else reject(new ApiError(res.error, 0, res.code, res.params));
    });
  });
}
