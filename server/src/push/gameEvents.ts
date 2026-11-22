// Push de las partidas online: "empezo la partida" y "es tu turno" (5.2). Escucha los cambios de
// estado del servicio de partidas y compara el estado anterior con el nuevo.

import { YOUR_TURN_MIN_DIE_SECONDS, type OnlineGameState } from '@roampass/shared';
import { hostUserId } from '../online/routes';
import { onlineService } from '../online/service';
import { pushLater } from './service';

const link = (s: OnlineGameState) => `/online/${s.id}`;

export function gamePushesFor(prev: OnlineGameState, next: OnlineGameState) {
  const started = prev.online.phase === 'LOBBY' && next.online.phase !== 'LOBBY' && next.status !== 'FINISHED';
  if (started) {
    // Al empezar solo "empezo la partida" (sin un "es tu turno" extra para el primero).
    const host = hostUserId(next);
    const hostName = next.players[next.online.userIds.indexOf(host)]?.name ?? '';
    for (const userId of next.online.userIds) {
      if (userId !== host) pushLater(userId, 'GAME_STARTED', { params: { host: hostName }, link: link(next), tag: `game-${next.id}`, ttlSeconds: 10 * 60 });
    }
    return;
  }
  const newTurn =
    next.online.phase === 'AWAITING_ROLL' &&
    (prev.online.phase !== 'AWAITING_ROLL' || prev.currentPlayerIndex !== next.currentPlayerIndex);
  if (newTurn && next.online.dieTimeoutSeconds >= YOUR_TURN_MIN_DIE_SECONDS) {
    const userId = next.online.userIds[next.currentPlayerIndex];
    if (userId) pushLater(userId, 'YOUR_TURN', { link: link(next), tag: `game-${next.id}`, ttlSeconds: next.online.dieTimeoutSeconds });
  }
}

export function registerGamePushes() {
  onlineService.onChange((next, prev) => {
    if (prev) gamePushesFor(prev, next);
  });
}
