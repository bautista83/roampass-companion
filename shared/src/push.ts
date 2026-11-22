// Notificaciones push de la app para celulares (docs/specs/mobile-app.md, 5.2).

/** Tipos de aviso. Cada usuario puede apagar cualquiera desde su perfil (User.pushMuted). */
export const PUSH_TYPES = ['GAME_INVITE', 'GAME_STARTED', 'YOUR_TURN', 'INVITE_ACCEPTED', 'INVITE_REGISTERED'] as const;
export type PushType = (typeof PUSH_TYPES)[number];

export const DEVICE_PLATFORMS = ['ANDROID', 'IOS'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** "Es tu turno" solo con tiempos de dado de al menos este valor (P3): con menos llega tarde. */
export const YOUR_TURN_MIN_DIE_SECONDS = 60;

/** Dispositivos por usuario (D9): al registrar uno mas se borra el mas viejo. */
export const MAX_DEVICES_PER_USER = 10;
