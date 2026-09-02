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
              id: true,
              name: true,
              email: true,
              username: true,
              estado: true,
              tenantMemberships: { select: { tenantId: true, estado: true } },
              sessions: {
                where: { expiresAt: { gt: new Date() } },
                select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
                orderBy: { updatedAt: "desc" },
              },
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.auditoria.findMany({ where: { tenantId: context.tenantId }, orderBy: { creadaEn: "desc" }, take: 100 }),
    ]);

    const safeMemberships = memberships.map((membership) => {
      const sharedIdentity = membership.user.tenantMemberships.filter((item) => item.estado === "activo").length > 1;
      const { tenantMemberships: _tenantMemberships, sessions, ...user } = membership.user;
      return {
        ...membership,
        user: {
          ...user,
          sharedIdentity,
          sessions: sharedIdentity ? [] : sessions,
        },
      };
    });

    return { success: true, data: serializeData({ memberships: safeMemberships, audits, currentUserId: context.userId }) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

async function ensureSessionCanBeManagedByTenant(tenantId: number, userId: string) {
  const memberships = await prisma.tenantUsuario.findMany({
    where: { userId, estado: "activo" },
    select: { tenantId: true },
  });
  if (!memberships.some((membership) => membership.tenantId === tenantId)) {
    throw new Error("Empleado no encontrado");
  }
  if (memberships.length > 1) {
    throw new Error("La identidad pertenece a más de un tenant; sus sesiones globales sólo pueden administrarse desde SuperAdmin");
  }
}

export async function revocarSesionEmpleado(sessionId: string) {
  try {
    const context = await requireStaffContext({ roles: adminRoles });
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });
    if (!session) {
      await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "session.revocar", entidad: "Session", entidadId: sessionId, resultado: "rechazado" });
      return { success: false, error: "Sesión no encontrada" };
    }

    await ensureSessionCanBeManagedByTenant(context.tenantId, session.userId);
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
    await ensureSessionCanBeManagedByTenant(context.tenantId, userId);
    const result = await prisma.session.deleteMany({ where: { userId } });
    await writeAudit({ tenantId: context.tenantId, actorUserId: context.userId, accion: "session.revocar_todas", entidad: "User", entidadId: userId, metadata: { cantidad: result.count } });
    return { success: true, cantidad: result.count };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudieron cerrar las sesiones" };
  }
}
