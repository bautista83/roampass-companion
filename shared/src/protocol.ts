// Contrato de tiempo real (Socket.IO) entre cliente y servidor para las partidas online.
// Ver docs/specs/online-multiplayer.md (8.3). Lo usan los dos lados: un cambio aca lo detecta TypeScript.

import type { OnlineAnswer, PublicGameView } from './online';
import type { PawnColor, VictoryMode } from './types';

/** Respuesta de cada accion (acknowledgement): igual que los errores de la API. */
export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: string; params?: Record<string, unknown> };

export interface SessionRef {
  sessionId: string;
}

/** Invitacion pendiente, tal como la ve quien la recibe. */
export interface InviteSummary {
  id: string;
  sessionId: string;
  from: string;
  /** La partida ya empezo: entra con `initialMiles`. */
  started: boolean;
  initialMiles: number;
  mode: VictoryMode;
  target: number;
  players: { name: string; color: PawnColor; avatar: string }[];
  /** Colores en uso (incluidos los de quienes abandonaron). */
  takenColors: PawnColor[];
  expiresAt: string;
}

/** Estado completo para la mesa: la vista publica + quien esta conectado. */
export interface GameStatePayload {
  view: PublicGameView;
  /** userIds con la mesa abierta en este momento. */
  connected: string[];
}

export interface ServerToClientEvents {
  'game:state': (payload: GameStatePayload) => void;
  /** La sala se cancelo o ya no se puede ver. */
  'game:closed': (payload: SessionRef & { reason: 'CANCELLED' | 'REMOVED' }) => void;
  'invite:received': (invite: InviteSummary) => void;
  'invite:updated': (payload: { id: string; sessionId: string; status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED'; username: string }) => void;
}

type Action<P = SessionRef, R = object> = (payload: P, ack: (res: Ack<R>) => void) => void;

export interface ClientToServerEvents {
  /**
   * La app paso a primer plano o a segundo plano. Con la app visible no se mandan push (D7): el
   * aviso ya se ve en pantalla. Las conexiones que nunca lo mandan cuentan como visibles.
   */
  'client:visibility': (payload: { visible: boolean }) => void;
  /** Abrir la mesa (participantes). Responde con el estado completo. */
  'game:join': Action<SessionRef, GameStatePayload>;
  'game:leave': (payload: SessionRef) => void;
  'game:start': Action;
  'game:roll': Action;
  'game:pass': Action;
  'game:answer': Action<SessionRef & OnlineAnswer>;
  'lobby:leave': Action;
  'player:pause': Action;
  'player:resume': Action;
  'player:abandon': Action;
  'host:pause': Action;
  'host:resume': Action;
  'host:end': Action;
}
