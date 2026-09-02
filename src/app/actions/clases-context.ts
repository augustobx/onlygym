"use server";

import { RolTenant } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { canOperateClass, type ClassStaffRole } from "@/lib/class-operations-policy";

const roles = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION, RolTenant.ENTRENADOR];

export async function getClassOperationsContext() {
  try {
    const context = await requireStaffContext({ roles });
    await requireTenantModule(context.tenantId, "clases");
    const trainer = context.role === RolTenant.ENTRENADOR
      ? await prisma.perfilEntrenador.findFirst({
          where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" },
          select: { id: true },
        })
      : null;

    return {
      success: true,
      data: {
        role: context.role,
        branchId: context.branchId,
        trainerProfileId: trainer?.id ?? null,
        canManageActivityTypes: context.role === RolTenant.OWNER || context.role === RolTenant.ADMIN,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No autorizado" };
  }
}

export async function buscarSociosParaClase(claseId: number, query = "") {
  try {
    const context = await requireStaffContext({ roles });
    await requireTenantModule(context.tenantId, "clases");
    const id = z.number().int().positive().parse(claseId);
    const clean = query.trim();
    const trainer = context.role === RolTenant.ENTRENADOR
      ? await prisma.perfilEntrenador.findFirst({
          where: { tenantId: context.tenantId, userId: context.userId, estado: "activo" },
          select: { id: true },
        })
      : null;

    const gymClass = await prisma.clase.findFirst({
      where: { id, tenantId: context.tenantId, estado: "programada" },
      select: { sucursalId: true, entrenadorId: true },
    });
    if (!gymClass || !canOperateClass({
      role: context.role as ClassStaffRole,
      activeBranchId: context.branchId,
      trainerProfileId: trainer?.id ?? null,
      classBranchId: gymClass.sucursalId,
      classTrainerId: gymClass.entrenadorId,
    })) {
      return { success: false, error: "Clase no disponible o no autorizada" };
    }

    const members = await prisma.cliente.findMany({
      where: {
        tenantId: context.tenantId,
        estado: "activo",
        sucursales: { some: { id: gymClass.sucursalId } },
        ...(clean ? {
          OR: [
            { nombre: { contains: clean, mode: "insensitive" } },
            { apellido: { contains: clean, mode: "insensitive" } },
            { documento: { contains: clean } },
          ],
        } : {}),
      },
      select: { id: true, nombre: true, apellido: true, documento: true },
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
      take: 20,
    });

    return { success: true, data: serializeData(members) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudieron buscar socios" };
  }
}
