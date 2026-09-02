export function normalizeWhatsAppPhone(value?: string | null) {
  if (!value) return null;

  let digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);

  // Argentina: si ya viene en formato internacional, no lo alteramos.
  if (digits.startsWith("54")) return digits;

  // Para el formato local habitual (código de área + número), asumimos móvil argentino.
  if (digits.length === 10) return `549${digits}`;

  return digits.length >= 8 ? digits : null;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildMemberWelcomeMessage(input: {
  name: string;
  document: string;
  temporaryPassword: string;
  portalUrl: string;
}) {
  return [
    `Hola ${input.name} 👋`,
    "Te damos la bienvenida a tu gimnasio.",
    "",
    "Acceso al Portal del Socio:",
    `Usuario / DNI: ${input.document}`,
    `Contraseña temporal: ${input.temporaryPassword}`,
    `Portal: ${input.portalUrl}`,
    "",
    "Por seguridad, al ingresar te vamos a pedir que cambies la contraseña.",
  ].join("\n");
}
