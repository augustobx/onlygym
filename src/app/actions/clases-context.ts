"use server";

import { RolTenant } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireStaffContext, requireTenantModule } from "@/lib/tenant-context";
import { canOperateClass, type ClassStaffRole } from "@/lib/class-operations-policy";
import { writeAudit } from "@/lib/audit";

const roles = [RolTenant.OWNER, RolTenant.ADMIN, RolTenant.RECEPCION, RolTenant.ENTRENADOR];

async function trainerIdForContext(tenantId: number, userId: string, role: RolTenant) {
  if (role !== RolTenant.ENTRENADOR) return null;
  const trainer = await prisma.perfilEntrenador.findFirst({
    where: { tenantId, userId, estado: "activo" },
    select: { id: true },
  });
  return trainer?.id ?? null;
}

export async function getClassOperationsContext() {
  try {
    const context = await requireStaffContext({ roles });
    await requireTenantModule(context.tenantId, "clases");
    const trainerProfileId = await trainerIdForContext(context.tenantId, context.userId, context.role);

    return {
      success: true,
      data: {
        role: context.role,
        branchId: context.branchId,
        trainerProfileId,
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
    const trainerProfileId = await trainerIdForContext(context.tenantId, context.userId, context.role);

    const gymClass = await prisma.clase.findFirst({
      where: { id, tenantId: context.tenantId, estado: "programada" },
      select: { sucursalId: true, entrenadorId: true },
    });
    if (!gymClass || !canOperateClass({
      role: context.role as ClassStaffRole,
      activeBranchId: context.branchId,
      trainerProfileId,
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

export async function cancelarReservaClaseOperativa(claseId: number, clienteId: number) {
  try {
    const context = await requireStaffContext({ roles });
    await requireTenantModule(context.tenantId, "clases");
    const parsedClassId = z.number().int().positive().parse(claseId);
    const parsedClientId = z.number().int().positive().parse(clienteId);
    const trainerProfileId = await trainerIdForContext(context.tenantId, context.userId, context.role);

    const gymClass = await prisma.clase.findFirst({
      where: { id: parsedClassId, tenantId: context.tenantId },
      select: { id: true, sucursalId: true, entrenadorId: true, tipoClase: { select: { nombre: true } } },
    });
    if (!gymClass || !canOperateClass({
      role: context.role as ClassStaffRole,
      activeBranchId: context.branchId,
      trainerProfileId,
      classBranchId: gymClass.sucursalId,
      classTrainerId: gymClass.entrenadorId,
    })) {
      return { success: false, error: "Clase no encontrada o no autorizada" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.reservaClase.findFirst({
        where: {
          tenantId: context.tenantId,
          claseId: parsedClassId,
          clienteId: parsedClientId,
          estado: { in: ["confirmada", "espera"] },
        },
        select: { id: true, estado: true },
      });
      if (!existing) throw new Error("El socio no tiene una reserva activa en esta clase");

      const wasConfirmed = existing.estado === "confirmada";
      await tx.reservaClase.update({
        where: { id: existing.id },
        data: { estado: "cancelada", canceladaEn: new Date(), posicionEspera: null },
      });

      let promotedClientId: number | null = null;
      if (wasConfirmed) {
        const next = await tx.reservaClase.findFirst({
          where: { tenantId: context.tenantId, claseId: parsedClassId, estado: "espera" },
          orderBy: [{ posicionEspera: "asc" }, { creadaEn: "asc" }],
          select: { id: true, clienteId: true },
        });
        if (next) {
          promotedClientId = next.clienteId;
          await tx.reservaClase.update({
            where: { id: next.id },
            data: { estado: "confirmada", posicionEspera: null },
          });
          await tx.notificacion.create({
            data: {
              tenantId: context.tenantId,
              clienteId: next.clienteId,
              tipo: "reserva_confirmada",
              titulo: "¡Se liberó tu lugar!",
              mensaje: `Tu reserva para ${gymClass.tipoClase.nombre} pasó a confirmada.`,
            },
          });
        }
      }

      return { reservationId: existing.id, promotedClientId };
    });

    await writeAudit({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      accion: "reserva.admin_cancelar",
      entidad: "ReservaClase",
      entidadId: result.reservationId,
      metadata: { claseId: parsedClassId, clienteId: parsedClientId, promovidoClienteId: result.promotedClientId },
    });

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo cancelar la reserva" };
  }
}
