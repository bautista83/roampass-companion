import type { ServerToClientEvents } from '@roampass/shared';

type Emit = <E extends keyof ServerToClientEvents>(userId: string, event: E, ...args: Parameters<ServerToClientEvents[E]>) => void;

let emitter: Emit = () => {};

/** Lo registra el modulo de tiempo real; las rutas REST lo usan para avisar invitaciones. */
export const setUserEmitter = (fn: Emit) => {
  emitter = fn;
};

export const notifyUser: Emit = (userId, event, ...args) => emitter(userId, event, ...args);

let looking: (userId: string) => boolean = () => false;

/** Lo registra el modulo de tiempo real: el usuario tiene la app (o la web) a la vista. */
export const setLookingChecker = (fn: (userId: string) => boolean) => {
  looking = fn;
};

/** Con la app a la vista no se mandan push: el aviso ya se ve en pantalla (D7). */
export const isUserLooking = (userId: string) => looking(userId);
