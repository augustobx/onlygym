import { describe, expect, it } from "vitest";
import { RolTenant } from "@prisma/client";
import { ownsTenant, roleAllowed, selectActiveMembership, TenantSelectionRequiredError, tenantOwnedId, trainerMemberScope } from "../src/lib/access-policy";

const first = { tenantId: 10, rol: RolTenant.OWNER, tenant: { id: 10, slug: "gym-a", nombre: "Gym A", estado: "activo" } };
const second = { tenantId: 20, rol: RolTenant.ENTRENADOR, tenant: { id: 20, slug: "gym-b", nombre: "Gym B", estado: "activo" } };
const trial = { tenantId: 30, rol: RolTenant.OWNER, tenant: { id: 30, slug: "gym-trial", nombre: "Gym Trial", estado: "prueba" } };
const suspended = { tenantId: 40, rol: RolTenant.OWNER, tenant: { id: 40, slug: "gym-off", nombre: "Gym Off", estado: "suspendido" } };

describe("selección segura de tenant", () => {
  it("elige automáticamente el único tenant habilitado", () => {
    expect(selectActiveMembership([first], null)?.tenantId).toBe(10);
  });

  it("permite tenants en período de prueba", () => {
    expect(selectActiveMembership([trial], null)?.tenantId).toBe(30);
  });

  it("exige selección cuando existen varias membresías habilitadas", () => {
    expect(() => selectActiveMembership([first, trial], null)).toThrow(TenantSelectionRequiredError);
  });

  it("rechaza un tenant que no pertenece al usuario", () => {
    expect(selectActiveMembership([first, second], 999)).toBeNull();
  });

  it("acepta la membresía habilitada seleccionada", () => {
    expect(selectActiveMembership([first, second], 20)?.rol).toBe(RolTenant.ENTRENADOR);
  });

  it("rechaza tenants suspendidos", () => {
    expect(selectActiveMembership([suspended], null)).toBeNull();
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
