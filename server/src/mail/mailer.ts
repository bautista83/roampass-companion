import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env';
import { renderMail, type MailContent } from './templates';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtp) return null;
  transporter ??= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    // 465 = TLS directo; 587 (Brevo) = STARTTLS.
    secure: env.smtp.port === 465,
    ...(env.smtp.user && { auth: { user: env.smtp.user, pass: env.smtp.pass } }),
  });
  return transporter;
}

/**
 * Envia un correo con un boton/enlace. Sin SMTP configurado (desarrollo) no envia nada: imprime
 * el enlace en la consola para poder seguir el flujo.
 */
export async function sendLinkMail(to: string, content: MailContent, link: string): Promise<void> {
  const mail = renderMail(content, link);
  const transport = getTransporter();
  if (!transport) {
    console.log(`✉️  [sin SMTP] Para: ${to} · ${mail.subject}\n    ${link}`);
    return;
  }
  await transport.sendMail({ from: env.mailFrom, to, subject: mail.subject, html: mail.html, text: mail.text });
}
