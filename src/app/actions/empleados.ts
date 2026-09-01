"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { RolTenant } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

export async function getEmpleados() {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const users = await prisma.user.findMany({
      where: { tenantMemberships: { some: { tenantId: context.tenantId, estado: "activo" } } },
      include: { sucursales: true },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: serializeData(users) };
  } catch {
    return { success: false, error: "Error obteniendo empleados" };
  }
}

export async function updateEmpleado(id: string, data: { name?: string; nivel?: string; estado?: string }) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const owned = await prisma.tenantUsuario.findUnique({ where: { tenantId_userId: { tenantId: context.tenantId, userId: id } } });
    if (!owned) return { success: false, error: "Empleado no encontrado" };
    await prisma.user.update({ where: { id }, data });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "empleado.actualizar", entidad: "User", entidadId: id, metadata: { campos: Object.keys(data) } });
    revalidatePath("/dashboard/empleados");
    return { success: true };
  } catch {
    return { success: false, error: "Error actualizando empleado" };
  }
}

export async function toggleEmpleadoEstado(id: string, estadoActual: string) {
  try {
    const context = await requireStaffContext({ roles: [RolTenant.OWNER, RolTenant.ADMIN] });
    const owned = await prisma.tenantUsuario.findUnique({ where: { tenantId_userId: { tenantId: context.tenantId, userId: id } } });
    if (!owned) return { success: false, error: "Empleado no encontrado" };
    await prisma.user.update({
      where: { id },
      data: { estado: estadoActual === "activo" ? "inactivo" : "activo" }
    });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "empleado.cambiar_estado", entidad: "User", entidadId: id, metadata: { estadoAnterior: estadoActual, estadoNuevo: estadoActual === "activo" ? "inactivo" : "activo" } });
    revalidatePath("/dashboard/empleados");
    return { success: true };
  } catch {
    return { success: false, error: "Error cambiando estado" };
  }
}
