"use server";

import { RolTenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";

const adminRoles = [RolTenant.OWNER, RolTenant.ADMIN];

export async function getSeguridadAdmin() {
  try {
    const context = await requireStaffContext({ roles: adminRoles });
    const [memberships, audits] = await Promise.all([
      prisma.tenantUsuario.findMany({
        where: { tenantId: context.tenantId },
        include: {
          user: {
            select: {
              id: true, name: true, email: true, username: true, estado: true,
              sessions: { where: { expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true }, orderBy: { updatedAt: "desc" } },
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.auditoria.findMany({ where: { tenantId: context.tenantId }, orderBy: { creadaEn: "desc" }, take: 100 }),
    ]);
    return { success: true, data: serializeData({ memberships, audits, currentUserId: context.userId }) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

export async function revocarSesionEmpleado(sessionId: string) {
  try {
    const context = await requireStaffContext({ roles: adminRoles });
    const session = await prisma.session.findFirst({
      where: { id: sessionId, user: { tenantMemberships: { some: { tenantId: context.tenantId, estado: "activo" } } } },
      select: { id: true, userId: true },
    });
    if (!session) {
      await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "session.revocar", entidad: "Session", entidadId: sessionId, resultado: "rechazado" });
      return { success: false, error: "Sesión no encontrada" };
    }
    await prisma.session.delete({ where: { id: session.id } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "session.revocar", entidad: "User", entidadId: session.userId, metadata: { sessionId: session.id } });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo cerrar la sesión" };
  }
}

export async function revocarTodasLasSesionesEmpleado(userId: string) {
  try {
    const context = await requireStaffContext({ roles: adminRoles });
    const membership = await prisma.tenantUsuario.findUnique({ where: { tenantId_userId: { tenantId: context.tenantId, userId } }, select: { id: true } });
    if (!membership) {
      await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "session.revocar_todas", entidad: "User", entidadId: userId, resultado: "rechazado" });
      return { success: false, error: "Empleado no encontrado" };
    }
    const result = await prisma.session.deleteMany({ where: { userId } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "session.revocar_todas", entidad: "User", entidadId: userId, metadata: { cantidad: result.count } });
    return { success: true, cantidad: result.count };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudieron cerrar las sesiones" };
  }
}
