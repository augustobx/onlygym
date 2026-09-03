export type MembershipState = "none" | "active" | "expiring" | "expired";

export type MembershipSnapshot = {
  state: MembershipState;
  active: boolean;
  daysRemaining: number;
  expiration: Date | null;
};

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

  expiration.setHours(23, 59, 59, 999);
  const diff = expiration.getTime() - now.getTime();
  if (diff < 0) {
    return { state: "expired", active: false, daysRemaining: 0, expiration };
  }

  const daysRemaining = Math.max(0, Math.ceil(diff / 86_400_000));
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
