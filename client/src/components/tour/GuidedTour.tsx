import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

export interface TourStep {
  /** Valor del atributo data-tour del elemento a resaltar. Si no esta en pantalla, el paso se salta. */
  target: string;
  title: string;
  text: string;
}

const PAD = 8;
const GAP = 14;
const BUBBLE_W = 340;
/** Alto aproximado de la burbuja, para no sacarla de la pantalla. */
const BUBBLE_H = 210;
const SPRING = { type: 'spring', stiffness: 260, damping: 30 } as const;

const findTarget = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`);

/**
 * Recorrido guiado: oscurece la pantalla, resalta un elemento por paso y muestra una burbuja con
 * la explicacion. Generico: los pasos señalan elementos con `data-tour="..."`.
 */
export function GuidedTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  // Solo los pasos cuyo elemento existe (p. ej. "Continuar" o el modulo Admin no siempre estan).
  const [visible] = useState(() => steps.filter((s) => findTarget(s.target)));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = visible[index];
  const last = index === visible.length - 1;

  const measure = useCallback(() => {
    if (step) setRect(findTarget(step.target)?.getBoundingClientRect() ?? null);
  }, [step]);

  // Al cambiar de paso: llevar el elemento a la vista y medirlo (tambien mientras scrollea).
  useLayoutEffect(() => {
    if (!step) return;
    findTarget(step.target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    let frame = 0;
    const loop = () => {
      measure();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const stop = setTimeout(() => cancelAnimationFrame(frame), 900);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(stop);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') (last ? onClose() : setIndex((i) => i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  useEffect(() => {
    if (visible.length === 0) onClose();
  }, [visible.length, onClose]);

  if (!step) return null;

  const hole = rect && { x: rect.left - PAD, y: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(BUBBLE_W, vw - 32);
  let bubble: { top?: number; bottom?: number; left: number } = { left: (vw - width) / 2, top: vh / 2 - 80 };
  if (rect) {
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), vw - width - 16);
    const below = vh - rect.bottom;
    const clamp = (v: number) => Math.min(Math.max(v, 16), vh - BUBBLE_H - 16);
    // La burbuja va donde haya mas lugar (abajo o arriba del elemento), siempre dentro de la pantalla
    // aunque el elemento todavia se este desplazando hacia la vista.
    bubble = below >= rect.top ? { left, top: clamp(rect.bottom + PAD + GAP) } : { left, bottom: clamp(vh - rect.top + PAD + GAP) };
  }

  return createPortal(
    <div className="fixed inset-0 z-[1100]" role="dialog" aria-modal="true" aria-label="Recorrido por el panel">
      {/* Fondo oscuro con un "agujero" sobre el elemento. Tambien captura los clics: no se toca el panel. */}
      <svg className="absolute inset-0 size-full" onClick={onClose} aria-hidden>
        <defs>
          <mask id="rp-tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {hole && <motion.rect initial={false} animate={hole} transition={SPRING} rx={16} fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(17, 17, 17, 0.62)" mask="url(#rp-tour-hole)" />
      </svg>
      {hole && (
        <motion.div
          className="pointer-events-none absolute rounded-2xl border-3 border-sun"
          initial={false}
          animate={{ top: hole.y, left: hole.x, width: hole.width, height: hole.height }}
          transition={SPRING}
        />
      )}
      <motion.div
        key={step.target}
        className="sticker absolute bg-paper p-4 text-ink shadow-hard-lg dark:bg-[#1f231f] dark:text-passport-50"
        style={{ width, ...bubble }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        aria-live="polite"
      >
        <p className="label">
          {index + 1} de {visible.length}
        </p>
        <h2 className="mb-1 text-lg">{step.title}</h2>
        <p className="mb-4 text-sm">{step.text}</p>
        <div className="flex items-center gap-2">
          <button className="btn-ghost min-h-11 px-3 text-sm" onClick={onClose}>
            Saltar
          </button>
          <span className="flex-1" />
          {index > 0 && (
            <button className="btn-ghost min-h-11 px-3 text-sm" onClick={() => setIndex(index - 1)} aria-label="Paso anterior">
              ←
            </button>
          )}
          <button className="btn-primary min-h-11 px-4 text-sm" onClick={() => (last ? onClose() : setIndex(index + 1))}>
            {last ? '¡Listo!' : 'Siguiente →'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
