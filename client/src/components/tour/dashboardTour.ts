import type { TFunction } from 'i18next';
import type { TourStep } from './GuidedTour';

/** Elementos del panel que recorre el tour (data-tour). Los textos estan en tour.steps.<target>. */
const TARGETS = ['passport', 'new-game', 'continue', 'rules', 'stats', 'recent', 'admin', 'profile', 'tour'] as const;

/** Pasos del recorrido por el panel. Los que no estan en pantalla (Continuar, Admin) se saltan solos. */
export const dashboardTour = (t: TFunction): TourStep[] =>
  TARGETS.map((target) => ({ target, title: t(`tour.steps.${target}.title`), text: t(`tour.steps.${target}.text`) }));


const key = (userId: string) => `roampass-tour-panel:${userId}`;

/** Si el usuario ya vio el recorrido en este dispositivo. Si el almacenamiento falla, no se insiste. */
export function tourSeen(userId: string): boolean {
  try {
    return localStorage.getItem(key(userId)) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(userId: string): void {
  try {
    localStorage.setItem(key(userId), '1');
  } catch {
    // sin almacenamiento: solo se pierde el recordatorio
  }
}
