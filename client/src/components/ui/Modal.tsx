import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  open: boolean;
  /** Si no se pasa, el modal no se puede cerrar (p. ej. una carta sin responder). */
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'xl';
  /** Animacion de "dar vuelta la carta" al abrir. */
  flip?: boolean;
}

/**
 * Movil: ocupa el 95% de la pantalla. Tablet/escritorio: tarjeta centrada.
 */
export function Modal({ open, onClose, title, children, size = 'md', flip = false }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] grid place-items-center bg-passport-950/70 p-[2.5vw] backdrop-blur-sm md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ perspective: 1400 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`flex h-[95dvh] w-[95vw] flex-col overflow-hidden rounded-2xl bg-paper shadow-2xl ring-1 ring-passport-800/20 md:h-auto md:max-h-[90dvh] dark:bg-passport-900 dark:ring-white/10 ${
              size === 'xl' ? 'md:max-w-6xl' : 'md:max-w-2xl'
            }`}
            initial={flip ? { rotateY: 90, scale: 0.9 } : { y: 40, opacity: 0 }}
            animate={flip ? { rotateY: 0, scale: 1 } : { y: 0, opacity: 1 }}
            exit={flip ? { rotateY: -90, opacity: 0 } : { y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || onClose) && (
              <div className="flex items-center justify-between gap-3 border-b border-passport-800/10 px-4 py-3 md:px-6 dark:border-white/10">
                <div className="min-w-0 font-semibold">{title}</div>
                {onClose && (
                  <button className="btn-ghost size-12 shrink-0 px-0" onClick={onClose} aria-label="Cerrar">
                    ✕
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
