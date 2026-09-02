"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { RolTenant } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

function uiLevelFromRole(role: RolTenant) {
  if (role === RolTenant.OWNER || role === RolTenant.ADMIN) return "admin";
  if (role === RolTenant.ENTRENADOR) return "entrenador";
  return "cajero";
}

function roleFromUiLevel(level: string) {
  if (level === "admin" || level === "supervisor") return RolTenant.ADMIN;
  if (level === "entrenador") return RolTenant.ENTRENADOR;
  return RolTenant.RECEPCION;
}

export async function getEmpleados() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
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
              select: { id: true, nombre: true },
            },
            _count: { select: { tenantMemberships: true } },
          },
        },
      },
      orderBy: { user: { createdAt: "desc" } },
    });

    const users = memberships.map((membership) => ({
      ...membership.user,
      nivel: uiLevelFromRole(membership.rol),
      estado: membership.estado,
      rolTenant: membership.rol,
      identidadCompartida: membership.user._count.tenantMemberships > 1,
    }));
    return { success: true, data: serializeData(users) };
  } catch {
    return { success: false, error: "Error obteniendo empleados" };
  }
}

export async function updateEmpleado(id: string, data: { name?: string; nivel?: string; estado?: string }) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const owned = await prisma.tenantUsuario.findUnique({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
      include: { user: { select: { name: true, _count: { select: { tenantMemberships: true } } } } },
    });
    if (!owned) return { success: false, error: "Empleado no encontrado" };

    const requestedName = data.name?.trim();
    if (requestedName && requestedName !== owned.user.name && owned.user._count.tenantMemberships > 1) {
      return { success: false, error: "Esta identidad pertenece a más de un tenant; el nombre global no puede modificarse desde un gimnasio" };
    }

    const tenantUpdate: { rol?: RolTenant; estado?: string } = {};
    if (data.nivel && owned.rol !== RolTenant.OWNER) tenantUpdate.rol = roleFromUiLevel(data.nivel);
    if (data.estado) tenantUpdate.estado = data.estado === "activo" ? "activo" : "inactivo";

    await prisma.$transaction(async (tx) => {
      if (requestedName && requestedName !== owned.user.name) {
        await tx.user.update({ where: { id }, data: { name: requestedName } });
      }
      if (Object.keys(tenantUpdate).length) {
        await tx.tenantUsuario.update({
          where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
          data: tenantUpdate,
        });
      }
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "empleado.actualizar",
      entidad: "TenantUsuario",
      entidadId: owned.id,
      metadata: { campos: Object.keys(data) },
    });
    revalidatePath("/dashboard/empleados");
    return { success: true };
  } catch {
    return { success: false, error: "Error actualizando empleado" };
  }
}

export async function toggleEmpleadoEstado(id: string, estadoActual: string) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const owned = await prisma.tenantUsuario.findUnique({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
      select: { id: true, rol: true, estado: true },
    });
    if (!owned) return { success: false, error: "Empleado no encontrado" };
    if (owned.rol === RolTenant.OWNER && id === context.userId) {
      return { success: false, error: "No podés desactivar tu propia membresía OWNER" };
    }

    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    await prisma.tenantUsuario.update({
      where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
      data: { estado: nuevoEstado },
    });
    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "empleado.cambiar_estado",
      entidad: "TenantUsuario",
      entidadId: owned.id,
      metadata: { estadoAnterior: owned.estado, estadoNuevo: nuevoEstado },
    });
    revalidatePath("/dashboard/empleados");
    return { success: true };
  } catch {
    return { success: false, error: "Error cambiando estado" };
  }
}
