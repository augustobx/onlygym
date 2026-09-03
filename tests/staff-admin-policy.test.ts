import { describe, expect, it } from "vitest";
import { RolTenant } from "@prisma/client";
import {
  staffRoleFromUiLevel,
  staffRoleNeedsBranch,
  staffUiLevelFromRole,
  validateStaffAdminMutation,
} from "../src/lib/staff-admin-policy";

describe("staff administration policy", () => {
  it("maps only supported UI roles", () => {
    expect(staffRoleFromUiLevel("admin")).toBe(RolTenant.ADMIN);
    expect(staffRoleFromUiLevel("recepcion")).toBe(RolTenant.RECEPCION);
    expect(staffRoleFromUiLevel("entrenador")).toBe(RolTenant.ENTRENADOR);
    expect(staffRoleFromUiLevel("supervisor")).toBeNull();
    expect(staffUiLevelFromRole(RolTenant.OWNER)).toBe("owner");
  });

  it("protects OWNER from role and state changes", () => {
    expect(validateStaffAdminMutation({
      actorRole: RolTenant.ADMIN,
      targetRole: RolTenant.OWNER,
      isSelf: false,
      nextRole: RolTenant.OWNER,
      nextState: "activo",
      branchIds: [],
    })).toMatch(/OWNER/);

    expect(validateStaffAdminMutation({
      actorRole: RolTenant.OWNER,
      targetRole: RolTenant.OWNER,
      isSelf: true,
      nextRole: RolTenant.ADMIN,
      nextState: "activo",
      branchIds: [],
    })).toMatch(/OWNER/);
  });

  it("prevents self lockout and admin privilege escalation", () => {
    expect(validateStaffAdminMutation({
      actorRole: RolTenant.ADMIN,
      targetRole: RolTenant.ADMIN,
      isSelf: true,
      nextRole: RolTenant.RECEPCION,
      nextState: "activo",
      branchIds: [1],
    })).toMatch(/propio rol/);

    expect(validateStaffAdminMutation({
      actorRole: RolTenant.ADMIN,
      targetRole: RolTenant.RECEPCION,
      isSelf: false,
      nextRole: RolTenant.ADMIN,
      nextState: "activo",
      branchIds: [],
    })).toMatch(/Sólo OWNER/);
  });

  it("requires operational branches for branch-bound roles", () => {
    expect(staffRoleNeedsBranch(RolTenant.RECEPCION)).toBe(true);
    expect(staffRoleNeedsBranch(RolTenant.ENTRENADOR)).toBe(true);
    expect(staffRoleNeedsBranch(RolTenant.ADMIN)).toBe(false);

    expect(validateStaffAdminMutation({
      actorRole: RolTenant.OWNER,
      targetRole: RolTenant.ADMIN,
      isSelf: false,
      nextRole: RolTenant.ENTRENADOR,
      nextState: "activo",
      branchIds: [],
    })).toMatch(/sede asignada/);
  });
});
