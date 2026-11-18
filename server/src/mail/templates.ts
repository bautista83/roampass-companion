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

interface MailLocaleTexts {
  verifyEmail: Template;
  changeEmail: Template;
  resetPassword: Template;
  footer: string;
  linkFallback: string;
}

/** Español latino neutro. */
const es: MailLocaleTexts = {
  verifyEmail: (username) => ({
    subject: 'Confirma tu correo para activar tu pasaporte de RoamPass',
    heading: `¡Hola, ${username}!`,
    intro: ['Gracias por registrarte en RoamPass. Confirma tu correo para activar tu pasaporte y empezar a viajar.'],
    button: 'Confirmar mi correo',
    outro: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.',
  }),
  changeEmail: (username) => ({
    subject: 'Confirma tu nuevo correo de RoamPass',
    heading: `¡Hola, ${username}!`,
    intro: ['Pediste usar este correo en tu cuenta de RoamPass. Confírmalo para completar el cambio.'],
    button: 'Confirmar este correo',
    outro: 'El enlace vence en 24 horas. Si no pediste este cambio, ignora este mensaje: tu cuenta sigue igual.',
  }),
  resetPassword: (username) => ({
    subject: 'Recupera tu contraseña de RoamPass',
    heading: `¡Hola, ${username}!`,
    intro: ['Recibimos un pedido para cambiar la contraseña de tu cuenta de RoamPass.'],
    button: 'Elegir una contraseña nueva',
    outro: 'El enlace vence en 1 hora. Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.',
  }),
  footer: 'RoamPass · Viaja, adivina y explora',
  linkFallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
};

const MAIL_TEXTS: Record<Locale, MailLocaleTexts> = { es };

/** Arma el contenido de un correo en el idioma del usuario (si no esta, en el idioma por defecto). */
export function mailContent(kind: 'verifyEmail' | 'changeEmail' | 'resetPassword', username: string, locale?: string | null): MailContent {
  const lang = resolveLocale(locale);
  const texts = MAIL_TEXTS[lang] ?? MAIL_TEXTS[DEFAULT_LOCALE];
  return { locale: lang, ...texts[kind](username), footer: texts.footer, linkFallback: texts.linkFallback };
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Arma el correo en HTML (estilos en linea, como exigen los clientes de correo) y en texto plano. */
export function renderMail(content: MailContent, link: string): { subject: string; html: string; text: string } {
  const paragraphs = content.intro.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join('');
  const html = `<!doctype html>
<html lang="${content.locale}"><body style="margin:0;background:#eaf2e6;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdf6e3;border:3px solid #111111;border-radius:16px">
        <tr><td style="background:#ff5a5a;border-bottom:3px solid #111111;border-radius:13px 13px 0 0;padding:14px 20px;color:#ffffff;font-weight:bold;letter-spacing:2px">ROAMPASS · PASAPORTE</td></tr>
        <tr><td style="padding:24px 20px;font-size:16px;line-height:1.5">
          <h1 style="margin:0 0 16px;font-size:24px">${escape(content.heading)}</h1>
          ${paragraphs}
          <p style="margin:24px 0"><a href="${escape(link)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${escape(content.button)}</a></p>
          <p style="margin:0 0 16px;color:#5a6357;font-size:14px">${escape(content.outro)}</p>
          <p style="margin:0;color:#5a6357;font-size:12px">${escape(content.linkFallback)}<br><a href="${escape(link)}" style="color:#233462;word-break:break-all">${escape(link)}</a></p>
        </td></tr>
        <tr><td style="border-top:2px dashed #b9b9b9;padding:12px 20px;color:#5a6357;font-size:12px">${escape(content.footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [content.heading, '', ...content.intro, '', `${content.button}: ${link}`, '', content.outro, '', content.footer].join('\n');
  return { subject: content.subject, html, text };
}
