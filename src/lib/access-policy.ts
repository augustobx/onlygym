import { RolTenant } from "@prisma/client";

export type MembershipCandidate = {
  tenantId: number;
  rol: RolTenant;
  tenant: { id: number; slug: string; nombre: string; estado: string };
};

export class TenantSelectionRequiredError extends Error {
  constructor() {
    super("Seleccioná el gimnasio con el que querés trabajar");
    this.name = "TenantSelectionRequiredError";
  }
}

export function selectActiveMembership(
  memberships: MembershipCandidate[],
  requestedTenantId: number | null,
) {
  const active = memberships.filter((membership) => membership.tenant.estado === "activo");
  if (!active.length) return null;
  if (requestedTenantId) {
    return active.find((membership) => membership.tenantId === requestedTenantId) ?? null;
  }
  if (active.length === 1) return active[0];
  throw new TenantSelectionRequiredError();
}

export function trainerMemberScope(role: RolTenant, trainerProfileId: number | null) {
  if (role !== RolTenant.ENTRENADOR) return {};
  return { entrenadorId: trainerProfileId ?? -1 };
}

export function ownsTenant(resourceTenantId: number, contextTenantId: number) {
  return resourceTenantId === contextTenantId;
}

export function tenantOwnedId(tenantId: number, id: number) {
  return { tenantId, id } as const;
}

export function roleAllowed(role: RolTenant, allowed: readonly RolTenant[]) {
  return allowed.includes(role);
}
