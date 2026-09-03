import { RolTenant } from "@prisma/client";

export type StaffUiLevel = "admin" | "recepcion" | "entrenador";

export function staffUiLevelFromRole(role: RolTenant): StaffUiLevel | "owner" {
  if (role === RolTenant.OWNER) return "owner";
  if (role === RolTenant.ADMIN) return "admin";
  if (role === RolTenant.ENTRENADOR) return "entrenador";
  return "recepcion";
}

export function staffRoleFromUiLevel(level: string): RolTenant | null {
  if (level === "admin") return RolTenant.ADMIN;
  if (level === "recepcion") return RolTenant.RECEPCION;
  if (level === "entrenador") return RolTenant.ENTRENADOR;
  return null;
}

export function staffRoleNeedsBranch(role: RolTenant) {
  return role === RolTenant.RECEPCION || role === RolTenant.ENTRENADOR;
}

export function validateStaffAdminMutation(input: {
  actorRole: RolTenant;
  targetRole: RolTenant;
  isSelf: boolean;
  nextRole: RolTenant;
  nextState: "activo" | "inactivo";
  branchIds: number[];
}) {
  const { actorRole, targetRole, isSelf, nextRole, nextState, branchIds } = input;

  if (targetRole === RolTenant.OWNER) {
    if (!isSelf) return "La cuenta OWNER sólo puede ser administrada por su propio titular";
    if (nextRole !== RolTenant.OWNER || nextState !== "activo") {
      return "La membresía OWNER no puede cambiar de rol ni desactivarse desde el gimnasio";
    }
  }

  if (isSelf && targetRole !== RolTenant.OWNER) {
    if (nextRole !== targetRole) return "No podés cambiar tu propio rol";
    if (nextState !== "activo") return "No podés desactivar tu propio acceso";
  }

  if (actorRole === RolTenant.ADMIN && targetRole === RolTenant.ADMIN && !isSelf) {
    if (nextRole !== targetRole || nextState !== "activo") {
      return "Sólo OWNER puede cambiar el rol o estado de otro administrador";
    }
  }

  if (actorRole === RolTenant.ADMIN && targetRole !== RolTenant.ADMIN && nextRole === RolTenant.ADMIN) {
    return "Sólo OWNER puede otorgar permisos de administrador";
  }

  if (staffRoleNeedsBranch(nextRole) && branchIds.length === 0) {
    return "Recepción y Entrenador deben tener al menos una sede asignada";
  }

  return null;
}
