import { expireDeadline, type Card, type OnlineGameState } from '@roampass/shared';
import { prisma } from '../db';
import { onlineDeck } from './deck';
import { loadOnline, saveOnline } from './store';

/** Recibe el estado nuevo y el anterior (para detectar transiciones: empezo, cambio el turno). */
type Listener = (state: OnlineGameState, previous?: OnlineGameState) => void;

/**
 * Orquesta las partidas online: cada accion se encola por partida (se procesa una a la vez), se
 * guarda con control de version, se avisa a los clientes y se reprograma el timer de la fase.
 * Una sola instancia del servidor (D6): colas y timers viven en memoria.
 */
class OnlineService {
  private queues = new Map<string, Promise<unknown>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private listeners = new Set<Listener>();
  private closedListeners = new Set<(sessionId: string) => void>();

  onChange(fn: Listener) {
    this.listeners.add(fn);
  }
  onClosed(fn: (sessionId: string) => void) {
    this.closedListeners.add(fn);
  }

  /** Aplica `fn` al estado actual de la partida y guarda el resultado. Devuelve el estado nuevo. */
  act(sessionId: string, fn: (state: OnlineGameState, deck: Card[]) => OnlineGameState | Promise<OnlineGameState>): Promise<OnlineGameState> {
    const previous = this.queues.get(sessionId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(async () => {
      const deck = await onlineDeck();
      const { state, version } = await loadOnline(sessionId);
      const next = await fn(state, deck);
      if (next === state) return state; // sin cambios (p. ej. un timer que llego tarde)
      await saveOnline(next, version);
      this.schedule(next);
      for (const listener of this.listeners) listener(next, state);
      return next;
    });
    this.queues.set(sessionId, run);
    // Limpia la cola al terminar. El error ya lo recibe quien llamo a act(): aca se ignora para no
    // dejar una promesa rechazada sin manejar (eso tiraria el proceso).
    run
      .finally(() => {
        if (this.queues.get(sessionId) === run) this.queues.delete(sessionId);
      })
      .catch(() => {});
    return run;
  }

  /** Avisa que la sala dejo de existir (la cancelo el anfitrion). */
  closed(sessionId: string) {
    this.clearTimer(sessionId);
    for (const listener of this.closedListeners) listener(sessionId);
  }

  private clearTimer(sessionId: string) {
    const t = this.timers.get(sessionId);
    if (t) clearTimeout(t);
    this.timers.delete(sessionId);
  }

  /** Programa el vencimiento de la fase actual (se pausa con la partida o al terminar). */
  schedule(state: OnlineGameState) {
    this.clearTimer(state.id);
    const deadline = state.online.deadline;
    if (state.status === 'FINISHED' || state.online.pausedByHost || !deadline) return;
    const wait = Math.max(0, new Date(deadline).getTime() - Date.now()) + 50;
    const timer = setTimeout(() => {
      this.timers.delete(state.id);
      this.act(state.id, (s, deck) => expireDeadline(s, deck, Math.random, new Date())).catch((err) =>
        console.error(`⏱ No se pudo aplicar el vencimiento de ${state.id}:`, err),
      );
    }, wait);
    timer.unref?.();
    this.timers.set(state.id, timer);
  }

  /**
   * Al arrancar: reprograma los timers de las partidas en curso. Si un deadline vencio con el
   * servidor apagado, el timer sale enseguida y lo resuelve (CA-31).
   */
  async init() {
    const sessions = await prisma.gameSession.findMany({ where: { kind: 'ONLINE', status: 'PLAYING' }, select: { state: true } });
    for (const s of sessions) this.schedule(s.state as unknown as OnlineGameState);
    if (sessions.length) console.log(`🌐 ${sessions.length} partida(s) online retomadas`);
  }
}

export const onlineService = new OnlineService();
