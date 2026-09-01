import { describe, expect, it } from "vitest";
import { RolTenant } from "@prisma/client";
import { ownsTenant, roleAllowed, selectActiveMembership, TenantSelectionRequiredError, tenantOwnedId, trainerMemberScope } from "../src/lib/access-policy";

const first = { tenantId: 10, rol: RolTenant.OWNER, tenant: { id: 10, slug: "gym-a", nombre: "Gym A", estado: "activo" } };
const second = { tenantId: 20, rol: RolTenant.ENTRENADOR, tenant: { id: 20, slug: "gym-b", nombre: "Gym B", estado: "activo" } };

describe("selección segura de tenant", () => {
  it("elige automáticamente el único tenant activo", () => {
    expect(selectActiveMembership([first], null)?.tenantId).toBe(10);
  });

  it("exige selección cuando existen varias membresías", () => {
    expect(() => selectActiveMembership([first, second], null)).toThrow(TenantSelectionRequiredError);
  });

  it("rechaza un tenant que no pertenece al usuario", () => {
    expect(selectActiveMembership([first, second], 999)).toBeNull();
  });

  it("acepta solamente la membresía seleccionada y activa", () => {
    expect(selectActiveMembership([first, second], 20)?.rol).toBe(RolTenant.ENTRENADOR);
  });
});

describe("políticas de autorización", () => {
  it("restringe al entrenador a su perfil", () => {
    expect(trainerMemberScope(RolTenant.ENTRENADOR, 42)).toEqual({ entrenadorId: 42 });
    expect(trainerMemberScope(RolTenant.ENTRENADOR, null)).toEqual({ entrenadorId: -1 });
  });

  it("no aplica alcance de entrenador a owner", () => {
    expect(trainerMemberScope(RolTenant.OWNER, null)).toEqual({});
  });

  it("evalúa roles en servidor", () => {
    expect(roleAllowed(RolTenant.ADMIN, [RolTenant.OWNER, RolTenant.ADMIN])).toBe(true);
    expect(roleAllowed(RolTenant.RECEPCION, [RolTenant.OWNER, RolTenant.ADMIN])).toBe(false);
  });

  it("construye filtros que siempre incluyen el tenant", () => {
    expect(tenantOwnedId(10, 55)).toEqual({ tenantId: 10, id: 55 });
    expect(ownsTenant(10, 10)).toBe(true);
    expect(ownsTenant(20, 10)).toBe(false);
  });
});
