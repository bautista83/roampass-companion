// Textos de los correos por idioma (ver docs/specs/user-photo-and-email.md). El idioma sale del
// perfil del usuario (User.locale). Para sumar uno, agregar su entrada en MAIL_TEXTS.

import { DEFAULT_LOCALE, resolveLocale, type Locale } from '@roampass/shared';

export interface MailContent {
  /** Idioma del correo (atributo lang del HTML). */
  locale: Locale;
  subject: string;
  /** Titulo grande del correo. */
  heading: string;
  /** Parrafos antes del boton. */
  intro: string[];
  button: string;
  /** Parrafo despues del boton (vencimiento, aviso de seguridad). */
  outro: string;
  footer: string;
  linkFallback: string;
}

type Template = (username: string) => Omit<MailContent, 'locale' | 'footer' | 'linkFallback'>;

/** Correos de invitacion (docs/specs/email-invitations.md): el nombre es el de quien invita. */
export type InviteMailKind = 'friendInvite' | 'gameInvite' | 'gameInviteMember';

interface MailLocaleTexts {
  verifyEmail: Template;
  changeEmail: Template;
  resetPassword: Template;
  friendInvite: Template;
  gameInvite: Template;
  gameInviteMember: Template;
  footer: string;
  linkFallback: string;
  optOut: string;
}

/** Español latino neutro. */
const es: MailLocaleTexts = {
  verifyEmail: (username) => ({
    subject: 'Confirma tu correo para activar tu pasaporte de Roamle',
    heading: `¡Hola, ${username}!`,
    intro: ['Gracias por registrarte en Roamle. Confirma tu correo para activar tu pasaporte y empezar a viajar.'],
    button: 'Confirmar mi correo',
    outro: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.',
  }),
  changeEmail: (username) => ({
    subject: 'Confirma tu nuevo correo de Roamle',
    heading: `¡Hola, ${username}!`,
    intro: ['Pediste usar este correo en tu cuenta de Roamle. Confírmalo para completar el cambio.'],
    button: 'Confirmar este correo',
    outro: 'El enlace vence en 24 horas. Si no pediste este cambio, ignora este mensaje: tu cuenta sigue igual.',
  }),
  resetPassword: (username) => ({
    subject: 'Recupera tu contraseña de Roamle',
    heading: `¡Hola, ${username}!`,
    intro: ['Recibimos un pedido para cambiar la contraseña de tu cuenta de Roamle.'],
    button: 'Elegir una contraseña nueva',
    outro: 'El enlace vence en 1 hora. Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.',
  }),
  friendInvite: (from) => ({
    subject: `${from} te invita a sumarte a Roamle`,
    heading: '¡Hola!',
    intro: [`${from} te invita a Roamle, el juego de viajar, adivinar y explorar. Crea tu pasaporte y juega con tus amigos.`],
    button: 'Crear mi cuenta',
    outro: 'La invitación vence en 7 días. Si no conoces a quien te invita, ignora este mensaje.',
  }),
  gameInvite: (from) => ({
    subject: `${from} te invitó a jugar una partida de Roamle`,
    heading: '¡Hola!',
    intro: [`${from} te invitó a su partida online de Roamle, el juego de viajar, adivinar y explorar. Crea tu cuenta para sumarte.`],
    button: 'Crear mi cuenta y jugar',
    outro: 'La invitación vale mientras la partida siga en juego (hasta 7 días). Si no conoces a quien te invita, ignora este mensaje.',
  }),
  gameInviteMember: (from) => ({
    subject: `${from} te invitó a jugar una partida de Roamle`,
    heading: '¡Hola!',
    intro: [`${from} te invitó a su partida online de Roamle. Entra para aceptar la invitación.`],
    button: 'Entrar a Roamle',
    outro: 'La invitación dentro del juego vence en 10 minutos.',
  }),
  footer: 'Roamle · Viaja, adivina y explora',
  linkFallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
  optOut: '¿No quieres recibir más invitaciones de Roamle? Date de baja aquí.',
};

const MAIL_TEXTS: Record<Locale, MailLocaleTexts> = { es };

/** Arma el contenido de un correo en el idioma del usuario (si no esta, en el idioma por defecto). */
export function mailContent(kind: 'verifyEmail' | 'changeEmail' | 'resetPassword', username: string, locale?: string | null): MailContent {
  const lang = resolveLocale(locale);
  const texts = MAIL_TEXTS[lang] ?? MAIL_TEXTS[DEFAULT_LOCALE];
  return { locale: lang, ...texts[kind](username), footer: texts.footer, linkFallback: texts.linkFallback };
}

/** Correo de invitacion. Quien lo recibe no tiene perfil: va en el idioma por defecto. */
export function inviteMailContent(kind: InviteMailKind, fromUsername: string, locale?: string | null): MailContent {
  return { ...mailContent('verifyEmail', fromUsername, locale), ...MAIL_TEXTS[resolveLocale(locale)][kind](fromUsername) };
}

/** Texto del enlace de baja en el idioma del correo. */
export const optOutText = (locale: Locale) => (MAIL_TEXTS[locale] ?? MAIL_TEXTS[DEFAULT_LOCALE]).optOut;

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Arma el correo en HTML (estilos en linea, como exigen los clientes de correo) y en texto plano. */
export function renderMail(content: MailContent, link: string, optOutLink?: string): { subject: string; html: string; text: string } {
  const optOut = optOutLink ? optOutText(content.locale) : null;
  const paragraphs = content.intro.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join('');
  const html = `<!doctype html>
<html lang="${content.locale}"><body style="margin:0;background:#eaf2e6;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdf6e3;border:3px solid #111111;border-radius:16px">
        <tr><td style="background:#ff5a5a;border-bottom:3px solid #111111;border-radius:13px 13px 0 0;padding:14px 20px;color:#ffffff;font-weight:bold;letter-spacing:2px">ROAMLE · PASAPORTE</td></tr>
        <tr><td style="padding:24px 20px;font-size:16px;line-height:1.5">
          <h1 style="margin:0 0 16px;font-size:24px">${escape(content.heading)}</h1>
          ${paragraphs}
          <p style="margin:24px 0"><a href="${escape(link)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${escape(content.button)}</a></p>
          <p style="margin:0 0 16px;color:#5a6357;font-size:14px">${escape(content.outro)}</p>
          <p style="margin:0;color:#5a6357;font-size:12px">${escape(content.linkFallback)}<br><a href="${escape(link)}" style="color:#233462;word-break:break-all">${escape(link)}</a></p>
        </td></tr>
        <tr><td style="border-top:2px dashed #b9b9b9;padding:12px 20px;color:#5a6357;font-size:12px">${escape(content.footer)}${
          optOut ? `<br><a href="${escape(optOutLink!)}" style="color:#5a6357">${escape(optOut)}</a>` : ''
        }</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    content.heading,
    '',
    ...content.intro,
    '',
    `${content.button}: ${link}`,
    '',
    content.outro,
    '',
    content.footer,
    ...(optOut ? [`${optOut} ${optOutLink}`] : []),
  ].join('\n');
  return { subject: content.subject, html, text };
}
