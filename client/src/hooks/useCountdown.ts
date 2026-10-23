import { useEffect, useRef, useState } from 'react';
import { timerSecondsOf } from '@roampass/shared';
import { useGameStore, type ActiveDraw } from '../store/gameStore';

/**
 * Cuenta regresiva hasta `deadline` (epoch ms). Devuelve los milisegundos restantes y llama a
 * `onExpire` una sola vez al llegar a 0. Si `running` es false (carta ya respondida), se detiene.
 * Como el deadline es una hora absoluta, refrescar la pagina no reinicia el reloj.
 */
export function useCountdown(deadline: number | undefined, running: boolean, onExpire: () => void): number {
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (deadline === undefined || !running) return;
    const tick = setInterval(() => setNow(Date.now()), 100);
    const expire = setTimeout(() => onExpireRef.current(), Math.max(0, deadline - Date.now()));
    return () => {
      clearInterval(tick);
      clearTimeout(expire);
    };
  }, [deadline, running]);

  return deadline === undefined ? 0 : Math.max(0, deadline - now);
}

/** Timer de la carta abierta: cuando vence, llama a `onExpire` (salvo que ya se haya respondido). */
export function useCardTimer(draw: ActiveDraw, onExpire: () => void) {
  const totalSeconds = useGameStore((s) => (s.game ? timerSecondsOf(s.game) : 0));
  const stopped = Boolean(draw.resolved);
  const remainingMs = useCountdown(draw.deadline, !stopped, () => {
    if (!useGameStore.getState().active?.resolved) onExpire();
  });
  const timedOut = Boolean(draw.resolved?.result.timedOut);
  return { remainingMs: timedOut ? 0 : remainingMs, totalSeconds, stopped, timedOut, hasTimer: draw.deadline !== undefined };
}
