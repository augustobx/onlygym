export function normalizeWhatsAppPhone(value?: string | null) {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) return digits;
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

export function buildMemberTemporaryPasswordMessage(input: {
  name: string;
  document: string;
  temporaryPassword: string;
  portalUrl: string;
}) {
  return [
    `Hola ${input.name} 👋`,
    "Generamos una nueva contraseña temporal para tu Portal del Socio.",
    "",
    `Usuario / DNI: ${input.document}`,
    `Contraseña temporal: ${input.temporaryPassword}`,
    `Portal: ${input.portalUrl}`,
    "",
    "La contraseña anterior dejó de funcionar. Al ingresar te vamos a pedir que cambies esta clave temporal.",
  ].join("\n");
}

export function buildMembershipReminderMessage(input: {
  name: string;
  gymName: string;
  membershipName?: string | null;
  expirationDate?: string | null;
  expired?: boolean;
}) {
  const status = input.expirationDate
    ? `${input.expired ? "venció" : "vence"} el ${input.expirationDate}`
    : "necesita renovación";
  return `Hola ${input.name}! Te escribimos desde ${input.gymName}. Tu membresía${input.membershipName ? ` ${input.membershipName}` : ""} ${status}. Si querés, te ayudamos a renovarla. 💪`;
}
