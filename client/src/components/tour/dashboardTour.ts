import type { TourStep } from './GuidedTour';

/** Pasos del recorrido por el panel. Los que no estan en pantalla (Continuar, Admin) se saltan solos. */
export const DASHBOARD_TOUR: TourStep[] = [
  {
    target: 'passport',
    title: '🛂 Tu pasaporte',
    text: 'Es tu tarjeta de viajero: tu usuario, tu rol y si tu cuenta está vigente.',
  },
  {
    target: 'new-game',
    title: '✈️ Crear Nueva Partida',
    text: 'Desde acá arranca todo: elegís el tablero, la meta, el tiempo por carta y los jugadores.',
  },
  {
    target: 'continue',
    title: '▶ Continuar',
    text: 'Si dejaste una partida a medias, la retomás justo donde quedó.',
  },
  {
    target: 'rules',
    title: '📖 Cómo jugar',
    text: 'Las reglas paso a paso. Durante la partida también las tenés en el botón ❓.',
  },
  {
    target: 'stats',
    title: '🏆 Tus números',
    text: 'Partidas jugadas, victorias y tu récord de millas. Se actualizan solos al terminar cada partida.',
  },
  {
    target: 'recent',
    title: '🗺️ Últimas partidas',
    text: 'Las partidas recientes de todos los viajeros, con quién ganó cada una.',
  },
  {
    target: 'admin',
    title: '🛠️ Administración de usuarios',
    text: 'Solo para administradores: aprobá las cuentas nuevas (Activar), cambiá roles o contraseñas.',
  },
  {
    target: 'profile',
    title: '👤 Mi perfil',
    text: 'Cambiá tu contraseña y el estilo del juego: Cómic o Modo 80s.',
  },
  {
    target: 'tour',
    title: '🧭 ¿Lo querés ver de nuevo?',
    text: 'Este botón repite el recorrido cuando quieras. ¡Buen viaje!',
  },
];

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
