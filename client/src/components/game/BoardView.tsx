import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { BOARD, BOARD_SPACES, MILES_PER_SPACE, type GamePlayer } from '@roampass/shared';
import { useTranslation } from 'react-i18next';
import { useLabels } from '../../i18n/useLabels';
import { useThemeStore } from '../../store/themeStore';
import { AvatarIcon, PawnToken } from '../ui/PawnToken';

/** Carpeta de las fichas de casilla: en modo 80s, la version neon. */
const useSpacesDir = () => (useThemeStore((s) => s.retro) ? '/board/spaces-retro' : '/board/spaces');

const W = BOARD.width;
const H = BOARD.height;
/** Segundos por casilla al avanzar (cada casilla se eleva al pasar y el globito suma 500 mi). */
const STEP_SECONDS = 0.34;

const mod = (n: number) => ((n % BOARD_SPACES) + BOARD_SPACES) % BOARD_SPACES;
/** Pasos absolutos recorridos (no se reinicia al dar la vuelta, asi la animacion sabe el sentido). */
export const stepsOf = (miles: number) => Math.floor(Math.max(0, miles) / MILES_PER_SPACE);
const spaceXY = (steps: number): [number, number] => {
  const s = BOARD.spaces[mod(steps)]!;
  return [s.x, s.y];
};
/** El tramo del Pacifico guarda x mas alla del borde derecho: se vuelven a meter en el mapa. */
const normX = (x: number) => (x > W ? x - BOARD.wrapSpan : x);

/** Recorrido por el camino de `from` a `to` (pasos absolutos), partido donde cruza el borde del mapa. */
function routeSegments(from: number, to: number): [number, number][][] {
  const dir = to > from ? 1 : -1;
  const points: [number, number][] = [spaceXY(from)];
  for (let k = from; k !== to; k += dir) {
    const leg = BOARD.legs[mod(dir > 0 ? k : k - 1)]!;
    const inner = leg.slice(1).map(([x, y]) => [normX(x), y] as [number, number]);
    points.push(...(dir > 0 ? inner : inner.reverse()), spaceXY(k + dir));
  }
  const segments: [number, number][][] = [[]];
  for (const p of points) {
    const seg = segments.at(-1)!;
    const prev = seg.at(-1);
    if (prev && Math.abs(p[0] - prev[0]) > W / 2) segments.push([p]);
    else seg.push(p);
  }
  return segments.filter((s) => s.length > 0);
}

function Pawn(props: {
  player: GamePlayer;
  steps: number;
  offset: [number, number];
  isTurn: boolean;
  frozen: boolean;
  onStart: (id: string, steps: number) => void;
  onPass: (steps: number) => void;
  onArrive: (id: string, steps: number) => void;
}) {
  const { player, steps, offset, isTurn, frozen, onStart, onPass, onArrive } = props;
  const { miles } = useLabels();
  /** Millas recorridas en este movimiento (globito sobre la ficha); null cuando esta quieta. */
  const [traveled, setTraveled] = useState<number | null>(null);
  const [x0, y0] = spaceXY(steps);
  const mx = useMotionValue(x0);
  const my = useMotionValue(y0);
  const hop = useMotionValue(0);
  const left = useTransform(mx, (v) => `${(v / W) * 100}%`);
  const top = useTransform(my, (v) => `${(v / H) * 100}%`);
  const lift = useTransform(hop, (v) => `${v}cqw`);
  const shown = useRef(steps);
  // Los callbacks cambian con cada render del juego: se leen de una ref para no cortar la animacion.
  const cb = useRef({ onStart, onPass, onArrive });
  cb.current = { onStart, onPass, onArrive };
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (frozen || steps === shown.current) return;
    const from = shown.current;
    shown.current = steps;
    const count = Math.abs(steps - from);
    const segments = routeSegments(from, steps);
    const total = segments.reduce((n, s) => n + s.length, 0);
    cb.current.onStart(player.id, steps);

    const dir = steps > from ? 1 : -1;
    setTraveled(0);
    // Cada casilla del camino: se eleva y el globito suma (o resta) 500 millas.
    timers.current = Array.from({ length: count }, (_, i) =>
      setTimeout(() => {
        setTraveled(dir * (i + 1) * MILES_PER_SPACE);
        cb.current.onPass(from + dir * (i + 1));
      }, (i + 1) * STEP_SECONDS * 1000 - 60),
    );

    void (async () => {
      animate(hop, [0, -1.2, 0], { duration: STEP_SECONDS, repeat: count - 1, ease: 'easeOut' });
      for (const seg of segments) {
        mx.set(seg[0]![0]);
        my.set(seg[0]![1]);
        const duration = (count * STEP_SECONDS * seg.length) / total;
        await Promise.all([
          animate(mx, seg.map((p) => p[0]), { duration, ease: 'linear' }),
          animate(my, seg.map((p) => p[1]), { duration, ease: 'linear' }),
        ]);
      }
      setTimeout(() => setTraveled(null), 900);
      cb.current.onArrive(player.id, steps);
    })();
  }, [steps, frozen, mx, my, hop, player.id]);

  return (
    <motion.div className="absolute" style={{ left, top, zIndex: isTurn ? 30 : 20 }}>
      <div
        className="transition-transform duration-300"
        style={{ transform: `translate(-50%, -90%) translate(${offset[0]}cqw, ${offset[1]}cqw)` }}
      >
        <motion.div style={{ y: lift }} className="relative">
          <AnimatePresence>
            {traveled !== null && (
              <motion.span
                key="miles"
                className="sticker absolute bottom-full left-1/2 mb-[0.8cqw] -translate-x-1/2 bg-sun px-[0.8cqw] py-[0.2cqw] text-[max(1.3cqw,10px)] font-extrabold whitespace-nowrap text-ink tabular-nums shadow-hard-sm"
                initial={{ opacity: 0, y: 8, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <motion.span key={traveled} className="inline-block" initial={{ scale: 1.35 }} animate={{ scale: 1 }}>
                  {traveled >= 0 ? '✈️ +' : '↩️ −'}
                  {miles(Math.abs(traveled))}
                </motion.span>
              </motion.span>
            )}
          </AnimatePresence>
          <motion.div
            className="origin-bottom"
            animate={isTurn ? { scale: [1, 1.15, 1] } : { scale: 1 }}
            transition={isTurn ? { duration: 1.2, repeat: Infinity } : undefined}
          >
            <PawnToken avatar={player.avatar} color={player.color} title={player.name} className="block w-[4.4cqw] min-w-7" />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

const BADGE_TILT = [-4, 3, -2, 4, -3, 2];

/** La ficha de una casilla se eleva un instante cuando una ficha pasa por encima. */
function PassPop({ steps }: { steps: number }) {
  const dir = useSpacesDir();
  const index = mod(steps);
  const space = BOARD.spaces[index]!;
  const [x, y] = spaceXY(steps);
  const transport = space.type === 'transport';
  return (
    <motion.img
      src={`${dir}/${space.id}.svg`}
      alt=""
      className="pointer-events-none absolute z-10"
      style={{
        left: `${(x / W) * 100}%`,
        top: `${(y / H) * 100}%`,
        // El dibujo exportado tiene margen para la sombra: se escala para calzar sobre la ficha del mapa.
        width: transport ? '3.7cqw' : '3.85cqw',
        translateX: transport ? '-50%' : '-46.5%',
        translateY: transport ? '-50%' : '-46.5%',
        rotate: transport ? 0 : BADGE_TILT[index % BADGE_TILT.length],
      }}
      initial={{ y: 0, scale: 1 }}
      animate={{ y: ['0cqw', '-1.4cqw', '0cqw'], scale: [1, 1.22, 1] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    />
  );
}

/** Duracion del lugar destacado al llegar una ficha. */
export const SPOTLIGHT_MS = 2400;

/**
 * Al llegar una ficha, la ficha de esa casilla (el taxi en Cuba, la Torre Eiffel en Paris...) aparece
 * en grande en el centro del mapa, temblando, con un pulso sobre la casilla real.
 */
function Spotlight({ steps, player, onDone }: { steps: number; player: GamePlayer; onDone: () => void }) {
  const dir = useSpacesDir();
  const space = BOARD.spaces[mod(steps)]!;
  const [x, y] = spaceXY(steps);
  useEffect(() => {
    const t = setTimeout(onDone, SPOTLIGHT_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div className="pointer-events-none absolute inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.span
        className="absolute aspect-square w-[9cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.5cqw] border-sun"
        style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: [0.3, 1.6], opacity: [1, 0] }}
        transition={{ duration: 0.9, repeat: 2 }}
      />
      <div className="absolute inset-0 grid place-items-center bg-ink/25">
        <div className="flex flex-col items-center gap-[1.2cqw]">
          <motion.img
            src={`${dir}/${space.id}.svg`}
            alt=""
            className="w-[24cqw] max-w-64 drop-shadow-none"
            initial={{ scale: 0, rotate: -25 }}
            animate={{ scale: [0, 1.18, 1], rotate: [-25, 8, -7, 6, -5, 4, -3, 0] }}
            transition={{ scale: { duration: 0.5 }, rotate: { duration: 1.6, ease: 'easeInOut', delay: 0.2 } }}
          />
          <motion.p
            className="sticker bg-white px-[2cqw] py-[0.8cqw] text-center font-display text-[max(2.4cqw,14px)] leading-tight text-ink"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <AvatarIcon avatar={player.avatar} className="mr-[0.6cqw] inline-block size-[1.1em] align-[-0.15em]" />
            {space.name}
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

/** Desplazamiento (en cqw) para que varias fichas en la misma casilla no se tapen. */
function stackOffsets(players: GamePlayer[], stepsById: Record<string, number>): Record<string, [number, number]> {
  const bySpace = new Map<number, string[]>();
  for (const p of players) {
    const space = mod(stepsById[p.id]!);
    bySpace.set(space, [...(bySpace.get(space) ?? []), p.id]);
  }
  const out: Record<string, [number, number]> = {};
  for (const ids of bySpace.values()) {
    ids.forEach((id, i) => {
      if (ids.length === 1) out[id] = [0, 0];
      else {
        const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
        out[id] = [Math.cos(a) * 2.2, Math.sin(a) * 2.2];
      }
    });
  }
  return out;
}

/**
 * Tablero digital: el mapa de la vuelta al mundo con una ficha por jugador. Cada ficha se ubica en
 * millas / 500 y, cuando cambian sus millas, avanza (o retrocede) saltando casilla por casilla
 * por el camino. Mientras hay una carta abierta (`frozen`) las fichas esperan a que se cierre.
 */
export function BoardView(props: {
  players: GamePlayer[];
  currentPlayerId: string | null;
  frozen: boolean;
  onArrive: (player: GamePlayer, steps: number) => void;
  onMovingChange: (moving: boolean) => void;
}) {
  const { players, currentPlayerId, frozen, onArrive, onMovingChange } = props;
  const [zoom, setZoom] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const scroller = useRef<HTMLDivElement>(null);
  const retro = useThemeStore((s) => s.retro);
  const { t } = useTranslation();
  const [spot, setSpot] = useState<{ player: GamePlayer; steps: number; key: number } | null>(null);
  // La ficha cuenta como "en movimiento" hasta que termina de mostrarse el lugar al que llego.
  const [passing, setPassing] = useState<{ steps: number; key: number }[]>([]);
  const onPass = useCallback((steps: number) => {
    const key = Date.now() + Math.random();
    setPassing((list) => [...list, { steps, key }]);
    setTimeout(() => setPassing((list) => list.filter((p) => p.key !== key)), 600);
  }, []);
  const clearSpot = useCallback(() => {
    setSpot(null);
    if (moving.current.size === 0) onMovingChange(false);
  }, [onMovingChange]);
  const moving = useRef(new Set<string>());
  const [shownSteps, setShownSteps] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map((p) => [p.id, stepsOf(p.score)])),
  );

  const focus = useCallback(
    (steps: number) => {
      const el = scroller.current;
      if (!el || !zoom) return;
      const [x, y] = spaceXY(steps);
      el.scrollTo({
        left: (x / W) * el.scrollWidth - el.clientWidth / 2,
        top: (y / H) * el.scrollHeight - el.clientHeight / 2,
        behavior: 'smooth',
      });
    },
    [zoom],
  );

  const onStart = useCallback(
    (id: string, steps: number) => {
      moving.current.add(id);
      onMovingChange(true);
      focus(steps);
    },
    [focus, onMovingChange],
  );

  const onPawnArrive = useCallback(
    (id: string, steps: number) => {
      moving.current.delete(id);
      setShownSteps((s) => ({ ...s, [id]: steps }));
      const player = players.find((p) => p.id === id);
      if (player) {
        setSpot({ player, steps, key: Date.now() });
        onArrive(player, steps);
      }
      else if (moving.current.size === 0) onMovingChange(false);
    },
    [players, onArrive, onMovingChange],
  );

  // Con zoom (celular), la vista sigue a la ficha del jugador en turno.
  useEffect(() => {
    const current = players.find((p) => p.id === currentPlayerId);
    if (current) focus(stepsOf(current.score));
  }, [currentPlayerId, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const offsets = stackOffsets(players, { ...Object.fromEntries(players.map((p) => [p.id, stepsOf(p.score)])), ...shownSteps });

  return (
    <div className="sticker relative overflow-hidden bg-paper p-0 dark:bg-passport-950">
      <div ref={scroller} className="max-h-[70dvh] overflow-auto overscroll-contain">
        <div className="@container relative aspect-[16/10]" style={{ width: zoom ? '230%' : '100%' }}>
          <img
            src={retro ? '/board/board-retro.png' : '/board/board.svg'}
            alt={t('game.board.alt')}
            className="rp-pixel absolute inset-0 size-full select-none"
            draggable={false}
          />
          {players.map((p) => (
            <Pawn
              key={p.id}
              player={p}
              steps={stepsOf(p.score)}
              offset={moving.current.has(p.id) ? [0, 0] : (offsets[p.id] ?? [0, 0])}
              isTurn={p.id === currentPlayerId}
              frozen={frozen}
              onStart={onStart}
              onPass={onPass}
              onArrive={onPawnArrive}
            />
          ))}
          {passing.map((p) => (
            <PassPop key={p.key} steps={p.steps} />
          ))}
          <AnimatePresence>
            {spot && <Spotlight key={spot.key} steps={spot.steps} player={spot.player} onDone={clearSpot} />}
          </AnimatePresence>
        </div>
      </div>
      <button
        type="button"
        className="btn-ghost absolute right-2 bottom-2 min-h-10 px-3 text-sm"
        onClick={() => setZoom((z) => !z)}
        aria-pressed={zoom}
      >
        {zoom ? t('game.board.showAll') : t('game.board.zoomIn')}
      </button>
    </div>
  );
}
