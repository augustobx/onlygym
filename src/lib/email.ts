import "server-only";

import nodemailer from "nodemailer";

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM;
  if (!host || !from || !Number.isInteger(port)) {
    throw new Error("La recuperación de contraseña requiere SMTP_HOST, SMTP_PORT y SMTP_FROM");
  }
  return {
    host,
    port,
    from,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" }
      : undefined,
  };
}

export async function sendPasswordResetEmail(input: { email: string; name: string; url: string }) {
  const config = smtpConfig();
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
  await transport.sendMail({
    from: config.from,
    to: input.email,
    subject: "Restablecé tu contraseña de OnlyGym",
    text: `Hola ${input.name}. Para restablecer tu contraseña ingresá en este enlace: ${input.url}\n\nEl enlace vence en una hora. Si no lo solicitaste, ignorá este mensaje.`,
    html: `<p>Hola ${escapeHtml(input.name)}.</p><p>Usá el siguiente enlace para restablecer tu contraseña de OnlyGym:</p><p><a href="${escapeHtml(input.url)}">Restablecer contraseña</a></p><p>El enlace vence en una hora. Si no lo solicitaste, ignorá este mensaje.</p>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}
