"use server";

import { RolTenant } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";
import {
  staffRoleFromUiLevel,
  staffRoleNeedsBranch,
  staffUiLevelFromRole,
  validateStaffAdminMutation,
} from "@/lib/staff-admin-policy";

const ADMIN_ROLES = [RolTenant.OWNER, RolTenant.ADMIN];

type EmployeeUpdate = {
  name?: string;
  nivel?: string;
  estado?: string;
  sucursalIds?: number[];
};

function revalidateStaffPaths() {
  revalidatePath("/dashboard/empleados");
  revalidatePath("/dashboard/seguridad");
  revalidatePath("/seleccionar-sucursal");
  revalidatePath("/dashboard");
}

function normalizeBranchIds(values: number[] | undefined) {
  if (values === undefined) return null;
  if (!Array.isArray(values) || values.some((value) => !Number.isInteger(value) || value <= 0)) return undefined;
  return [...new Set(values)];
}

export async function getEmpleados() {
  try {
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const memberships = await prisma.tenantUsuario.findMany({
      where: { tenantId: context.tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            createdAt: true,
            sucursales: {
              where: { tenantId: context.tenantId },
              select: { id: true, nombre: true, estado: true },
              orderBy: { nombre: "asc" },
            },
            _count: { select: { tenantMemberships: true } },
          },
        },
      },
      orderBy: [{ rol: "asc" }, { user: { name: "asc" } }],
    });

    const users = memberships.map((membership) => ({
      ...membership.user,
      nivel: staffUiLevelFromRole(membership.rol),
      estado: membership.estado,
      rolTenant: membership.rol,
      identidadCompartida: membership.user._count.tenantMemberships > 1,
      isSelf: membership.userId === context.userId,
    }));
    return { success: true, data: serializeData(users) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error obteniendo empleados" };
  }
}

export async function updateEmpleado(id: string, data: EmployeeUpdate) {
  try {
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const owned = await prisma.tenantUsuario.findUnique({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
      include: {
        user: {
          select: {
            name: true,
            sucursales: { where: { tenantId: context.tenantId }, select: { id: true } },
            tenantMemberships: { where: { estado: "activo" }, select: { tenantId: true } },
            _count: { select: { tenantMemberships: true } },
          },
        },
      },
    });
    if (!owned) return { success: false, error: "Empleado no encontrado" };

    const requestedName = data.name?.trim();
    if (data.name !== undefined && !requestedName) return { success: false, error: "El nombre no puede quedar vacío" };
    if (requestedName && requestedName !== owned.user.name && owned.user._count.tenantMemberships > 1) {
      return { success: false, error: "Esta identidad pertenece a más de un tenant; el nombre global no puede modificarse desde un gimnasio" };
    }

    const nextRole = data.nivel !== undefined ? staffRoleFromUiLevel(data.nivel) : owned.rol;
    if (!nextRole) return { success: false, error: "Rol de empleado inválido" };

    const nextState = data.estado === undefined
      ? (owned.estado === "activo" ? "activo" : "inactivo")
      : data.estado === "activo" || data.estado === "inactivo"
        ? data.estado
        : null;
    if (!nextState) return { success: false, error: "Estado de empleado inválido" };

    const normalizedRequestedBranches = normalizeBranchIds(data.sucursalIds);
    if (normalizedRequestedBranches === undefined) return { success: false, error: "La lista de sedes es inválida" };
    const currentBranchIds = owned.user.sucursales.map(({ id: branchId }) => branchId);
    const effectiveBranchIds = normalizedRequestedBranches ?? currentBranchIds;

    const policyError = validateStaffAdminMutation({
      actorRole: context.role,
      targetRole: owned.rol,
      isSelf: id === context.userId,
      nextRole,
      nextState,
      branchIds: effectiveBranchIds,
    });
    if (policyError) return { success: false, error: policyError };

    let validatedBranchIds = effectiveBranchIds;
    if (staffRoleNeedsBranch(nextRole)) {
      const branches = await prisma.sucursal.findMany({
        where: { tenantId: context.tenantId, estado: "activo", id: { in: effectiveBranchIds } },
        select: { id: true },
      });
      if (branches.length !== effectiveBranchIds.length) {
        return { success: false, error: "Una de las sedes seleccionadas no está disponible" };
      }
      validatedBranchIds = branches.map(({ id: branchId }) => branchId);
    }

    const shouldRewriteBranches = data.sucursalIds !== undefined || nextRole !== owned.rol;
    const shouldCloseSessions = owned.estado === "activo"
      && nextState === "inactivo"
      && owned.user.tenantMemberships.length <= 1;

    await prisma.$transaction(async (tx) => {
      if (requestedName && requestedName !== owned.user.name) {
        await tx.user.update({ where: { id }, data: { name: requestedName } });
      }

      if (nextRole !== owned.rol || nextState !== owned.estado) {
        await tx.tenantUsuario.update({
          where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
          data: { rol: nextRole, estado: nextState },
        });
      }

      if (shouldRewriteBranches) {
        await tx.user.update({
          where: { id },
          data: {
            sucursales: {
              disconnect: currentBranchIds.map((branchId) => ({ id: branchId })),
              ...(staffRoleNeedsBranch(nextRole)
                ? { connect: validatedBranchIds.map((branchId) => ({ id: branchId })) }
                : {}),
            },
          },
        });
      }

      if (shouldCloseSessions) {
        await tx.session.deleteMany({ where: { userId: id } });
      }
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "empleado.actualizar",
      entidad: "TenantUsuario",
      entidadId: owned.id,
      metadata: {
        rolAnterior: owned.rol,
        rolNuevo: nextRole,
        estadoAnterior: owned.estado,
        estadoNuevo: nextState,
        sedes: staffRoleNeedsBranch(nextRole) ? validatedBranchIds : [],
        sesionesCerradas: shouldCloseSessions,
      },
    });
    revalidateStaffPaths();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error actualizando empleado" };
  }
}

export async function toggleEmpleadoEstado(id: string, _estadoActual?: string) {
  try {
    const context = await requireStaffContext({ roles: ADMIN_ROLES });
    const membership = await prisma.tenantUsuario.findUnique({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
      select: { estado: true },
    });
    if (!membership) return { success: false, error: "Empleado no encontrado" };
    return updateEmpleado(id, { estado: membership.estado === "activo" ? "inactivo" : "activo" });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error cambiando estado" };
  }
}
