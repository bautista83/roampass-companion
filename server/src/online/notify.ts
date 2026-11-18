import type { ServerToClientEvents } from '@roampass/shared';

type Emit = <E extends keyof ServerToClientEvents>(userId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>) => void;

let emitter: Emit = () => {};

/** Lo registra el modulo de tiempo real; las rutas REST lo usan para avisar invitaciones. */
export const setUserEmitter = (fn: Emit) => {
  emitter = fn;
};

export const notifyUser: Emit = (userId, event, ...args) => emitter(userId, event, ...args);
