// Textos de las notificaciones (D14): en el idioma del perfil, como los correos.
import { DEFAULT_LOCALE, resolveLocale, type Locale, type PushType } from '@roampass/shared';

export interface PushParams {
  from?: string;
  host?: string;
  username?: string;
}

type Texts = Record<PushType, (p: PushParams) => { title: string; body: string }>;

const PUSH_TEXTS: Record<Locale, Texts> = {
  es: {
    GAME_INVITE: (p) => ({ title: `${p.from} te invitó a una partida`, body: 'Tienes 10 minutos para unirte. Toca para ver la sala.' }),
    GAME_STARTED: (p) => ({ title: `¡Empezó la partida de ${p.host}!`, body: 'Entra para no perder tu turno.' }),
    YOUR_TURN: () => ({ title: 'Es tu turno en Roamle', body: 'Tira el dado antes de que se acabe el tiempo.' }),
    INVITE_ACCEPTED: (p) => ({ title: `${p.username} se unió a tu partida`, body: 'Toca para ver la sala.' }),
    INVITE_REGISTERED: (p) => ({ title: `${p.username} se registró con tu invitación`, body: '¡Ya pueden jugar juntos!' }),
  },
};

export function pushText(type: PushType, params: PushParams, locale?: string | null) {
  const texts = PUSH_TEXTS[resolveLocale(locale)] ?? PUSH_TEXTS[DEFAULT_LOCALE];
  return texts[type](params);
}
