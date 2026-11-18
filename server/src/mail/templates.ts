// Textos de los correos, en un solo lugar para poder traducirlos (ver docs/specs/user-photo-and-email.md).
// Español latino neutro.

export interface MailContent {
  subject: string;
  /** Titulo grande del correo. */
  heading: string;
  /** Parrafos antes del boton. */
  intro: string[];
  button: string;
  /** Parrafo despues del boton (vencimiento, aviso de seguridad). */
  outro: string;
}

export const mailTexts = {
  verifyEmail: (username: string): MailContent => ({
    subject: 'Confirma tu correo para activar tu pasaporte de RoamPass',
    heading: `¡Hola, ${username}!`,
    intro: ['Gracias por registrarte en RoamPass. Confirma tu correo para activar tu pasaporte y empezar a viajar.'],
    button: 'Confirmar mi correo',
    outro: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este mensaje.',
  }),
  changeEmail: (username: string): MailContent => ({
    subject: 'Confirma tu nuevo correo de RoamPass',
    heading: `¡Hola, ${username}!`,
    intro: ['Pediste usar este correo en tu cuenta de RoamPass. Confírmalo para completar el cambio.'],
    button: 'Confirmar este correo',
    outro: 'El enlace vence en 24 horas. Si no pediste este cambio, ignora este mensaje: tu cuenta sigue igual.',
  }),
  resetPassword: (username: string): MailContent => ({
    subject: 'Recupera tu contraseña de RoamPass',
    heading: `¡Hola, ${username}!`,
    intro: ['Recibimos un pedido para cambiar la contraseña de tu cuenta de RoamPass.'],
    button: 'Elegir una contraseña nueva',
    outro: 'El enlace vence en 1 hora. Si no lo pediste, ignora este mensaje: tu contraseña sigue igual.',
  }),
  footer: 'RoamPass · Viaja, adivina y explora',
  linkFallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
};

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Arma el correo en HTML (estilos en linea, como exigen los clientes de correo) y en texto plano. */
export function renderMail(content: MailContent, link: string): { subject: string; html: string; text: string } {
  const paragraphs = content.intro.map((p) => `<p style="margin:0 0 16px">${escape(p)}</p>`).join('');
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#eaf2e6;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdf6e3;border:3px solid #111111;border-radius:16px">
        <tr><td style="background:#ff5a5a;border-bottom:3px solid #111111;border-radius:13px 13px 0 0;padding:14px 20px;color:#ffffff;font-weight:bold;letter-spacing:2px">ROAMPASS · PASAPORTE</td></tr>
        <tr><td style="padding:24px 20px;font-size:16px;line-height:1.5">
          <h1 style="margin:0 0 16px;font-size:24px">${escape(content.heading)}</h1>
          ${paragraphs}
          <p style="margin:24px 0"><a href="${escape(link)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:12px">${escape(content.button)}</a></p>
          <p style="margin:0 0 16px;color:#5a6357;font-size:14px">${escape(content.outro)}</p>
          <p style="margin:0;color:#5a6357;font-size:12px">${escape(mailTexts.linkFallback)}<br><a href="${escape(link)}" style="color:#233462;word-break:break-all">${escape(link)}</a></p>
        </td></tr>
        <tr><td style="border-top:2px dashed #b9b9b9;padding:12px 20px;color:#5a6357;font-size:12px">${escape(mailTexts.footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [content.heading, '', ...content.intro, '', `${content.button}: ${link}`, '', content.outro, '', mailTexts.footer].join('\n');
  return { subject: content.subject, html, text };
}
