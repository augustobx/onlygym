"use server";

import { RolTenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";

const TRAINER_DASHBOARD_ROLES = [RolTenant.ENTRENADOR, RolTenant.OWNER, RolTenant.ADMIN];

export async function getDashboardEntrenador() {
  try {
    const context = await requireStaffContext({ roles: TRAINER_DASHBOARD_ROLES });
    await requireTenantModule(context.tenantId, "entrenamiento");
    if (!context.branchId) throw new Error("Seleccioná una sucursal antes de abrir el panel del entrenador");

    const branch = await prisma.sucursal.findFirst({
      where: { id: context.branchId, tenantId: context.tenantId, estado: "activo" },
      select: { id: true, nombre: true },
    });
    if (!branch) throw new Error("La sede activa ya no está disponible");

    const profile = await prisma.perfilEntrenador.findFirst({
      where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" },
      include: {
        user: { select: { name: true, image: true } },
        sucursales: { select: { id: true, nombre: true } },
      },
    });
    if (context.role === RolTenant.ENTRENADOR && !profile) {
      return { success: false, error: "Tu perfil de entrenador no está activo" };
    }
    if (context.role === RolTenant.ENTRENADOR && !profile?.sucursales.some(({ id }) => id === branch.id)) {
      return { success: false, error: "Tu perfil de entrenador no está asignado a la sede activa" };
    }

    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 86400000);
    const inactiveSince = new Date(now.getTime() - 7 * 86400000);
    const measurementSince = new Date(now.getTime() - 30 * 86400000);
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);

    const trainerFilter = context.role === RolTenant.ENTRENADOR ? { entrenadorId: profile?.id ?? -1 } : {};
    const memberWhere = {
      tenantId: context.tenantId,
      estado: "activo",
      sucursales: { some: { id: branch.id } },
      ...trainerFilter,
    } as const;

    const [members, classes, inactiveMembers, measurementsPending, workoutsToday] = await Promise.all([
      prisma.cliente.findMany({
        where: memberWhere,
        include: {
          mediciones: { orderBy: { fecha: "desc" }, take: 1 },
          ingresos: {
            where: { tenantId: context.tenantId, sucursalId: branch.id, estado: { in: ["permitido", "ACTIVO"] } },
            orderBy: { fechaHora: "desc" },
            take: 1,
          },
          asignacionesEntrenamiento: {
            where: { estado: "activa" },
            include: { plan: { select: { nombre: true } }, rutina: { select: { nombre: true } } },
            take: 1,
          },
          sesionesEntrenamiento: {
            where: { estado: "finalizada" },
            orderBy: { iniciadaEn: "desc" },
            take: 1,
            select: { iniciadaEn: true },
          },
        },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        take: 100,
      }),
      prisma.clase.findMany({
        where: {
          tenantId: context.tenantId,
          sucursalId: branch.id,
          estado: "programada",
          inicio: { gte: now, lte: inSevenDays },
          ...(context.role === RolTenant.ENTRENADOR ? { entrenadorId: profile?.id ?? -1 } : {}),
        },
        include: {
          tipoClase: true,
          sucursal: true,
          _count: { select: { reservas: { where: { estado: { in: ["confirmada", "asistio"] } } } } },
        },
        orderBy: { inicio: "asc" },
      }),
      prisma.cliente.findMany({
        where: {
          ...memberWhere,
          ingresos: {
            none: {
              tenantId: context.tenantId,
              sucursalId: branch.id,
              estado: { in: ["permitido", "ACTIVO"] },
              fechaHora: { gte: inactiveSince },
            },
          },
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          ingresos: {
            where: { tenantId: context.tenantId, sucursalId: branch.id, estado: { in: ["permitido", "ACTIVO"] } },
            orderBy: { fechaHora: "desc" },
            take: 1,
          },
        },
        take: 20,
      }),
      prisma.cliente.findMany({
        where: {
          ...memberWhere,
          OR: [
            { mediciones: { none: {} } },
            { mediciones: { none: { fecha: { gte: measurementSince } } } },
          ],
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          mediciones: { orderBy: { fecha: "desc" }, take: 1, select: { fecha: true } },
        },
        orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
        take: 20,
      }),
      prisma.sesionEntrenamiento.count({
        where: {
          tenantId: context.tenantId,
          cliente: memberWhere,
          iniciadaEn: { gte: startToday, lt: endToday },
        },
      }),
    ]);

    return {
      success: true,
      data: serializeData({
        trainer: profile,
        branch,
        members,
        classes,
        inactiveMembers,
        measurementsPending,
        workoutsToday,
      }),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}
