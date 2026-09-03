export type MembershipState = "none" | "active" | "expiring" | "expired";

export type MembershipSnapshot = {
  state: MembershipState;
  active: boolean;
  daysRemaining: number;
  expiration: Date | null;
};

const DAY_MS = 86_400_000;

function utcCalendarDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function membershipSnapshot(
  expirationValue: string | Date | null | undefined,
  now: Date = new Date(),
): MembershipSnapshot {
  if (!expirationValue) {
    return { state: "none", active: false, daysRemaining: 0, expiration: null };
  }

  const expiration = new Date(expirationValue);
  if (Number.isNaN(expiration.getTime())) {
    return { state: "none", active: false, daysRemaining: 0, expiration: null };
  }

  // Las membresías vencen al final de su fecha calendario, no a la hora exacta
  // almacenada en la base. Esto evita marcar como vencida una membresía durante
  // el mismo día de vencimiento.
  expiration.setHours(23, 59, 59, 999);
  const diff = expiration.getTime() - now.getTime();
  if (diff < 0) {
    return { state: "expired", active: false, daysRemaining: 0, expiration };
  }

  // "Vence en N días" es una diferencia de fechas calendario. Si hoy es 3 y
  // vence el 10, son 7 días aunque todavía falten algunas horas adicionales.
  const calendarDiff = utcCalendarDay(expiration) - utcCalendarDay(now);
  const daysRemaining = Math.max(0, Math.round(calendarDiff / DAY_MS));

  return {
    state: daysRemaining <= 7 ? "expiring" : "active",
    active: true,
    daysRemaining,
    expiration,
  };
}

export function isMembershipActive(expirationValue: string | Date | null | undefined, now: Date = new Date()) {
  return membershipSnapshot(expirationValue, now).active;
}
