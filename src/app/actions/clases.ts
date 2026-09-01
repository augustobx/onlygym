"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireMemberContext } from "@/lib/member-context";
import { requireTenantModule } from "@/lib/tenant-context";
import { writeAudit } from "@/lib/audit";
import { getBookingPlacement, normalizeWaitingPositions } from "@/lib/class-booking-policy";

async function serializableBooking<T>(operation: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if ((error as { code?: string }).code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new Error("No se pudo confirmar la reserva");
}

export async function getClasesDisponibles() {
  try {
    const context = await requireMemberContext();
    await requireTenantModule(context.tenantId, "clases");
    const classes = await prisma.clase.findMany({
      where: { tenantId: context.tenantId, estado: "programada", inicio: { gte: new Date() } },
      include: {
        tipoClase: true,
        sucursal: true,
        entrenador: { include: { user: { select: { name: true, image: true } } } },
        reservas: { where: { estado: { in: ["confirmada", "asistio"] } }, select: { id: true } },
      },
      orderBy: { inicio: "asc" },
      take: 60,
    });
    const ownBookings = await prisma.reservaClase.findMany({
      where: { tenantId: context.tenantId, clienteId: context.clienteId, claseId: { in: classes.map((item) => item.id) } },
      select: { claseId: true, estado: true, posicionEspera: true },
    });
    const ownBookingByClass = new Map(ownBookings.map((booking) => [booking.claseId, booking]));
    return { success: true, data: serializeData(classes.map((item) => ({
      ...item,
      reservados: item.reservas.length,
      disponibles: Math.max(0, item.cupoMaximo - item.reservas.length),
      miReserva: ownBookingByClass.get(item.id) || null,
    }))) };
  } catch {
    return { success: false, error: "No autorizado" };
  }
}

export async function reservarClase(claseId: number) {
  try {
    if (!Number.isInteger(claseId) || claseId <= 0) throw new Error("Clase inválida");
    const context = await requireMemberContext();
    await requireTenantModule(context.tenantId, "clases");
    const booking = await serializableBooking(() => prisma.$transaction(async (tx) => {
      const gymClass = await tx.clase.findFirst({ where: { id: claseId, tenantId: context.tenantId, estado: "programada", inicio: { gt: new Date() } } });
      if (!gymClass) throw new Error("Clase no disponible");
      const existing = await tx.reservaClase.findUnique({ where: { claseId_clienteId: { claseId, clienteId: context.clienteId } } });
      if (existing && existing.estado !== "cancelada") return existing;

      const confirmed = await tx.reservaClase.count({ where: { claseId, estado: { in: ["confirmada", "asistio"] } } });
      const waiting = await tx.reservaClase.count({ where: { claseId, estado: "espera" } });
      const placement = getBookingPlacement(confirmed, gymClass.cupoMaximo, waiting);
      return tx.reservaClase.upsert({
        where: { claseId_clienteId: { claseId, clienteId: context.clienteId } },
        update: { estado: placement.estado, posicionEspera: placement.posicionEspera, canceladaEn: null },
        create: { tenantId: context.tenantId, claseId, clienteId: context.clienteId, estado: placement.estado, posicionEspera: placement.posicionEspera },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    await writeAudit({ tenantId: context.tenantId, actorClienteId: context.clienteId, accion: "reserva.crear", entidad: "ReservaClase", entidadId: booking.id, metadata: { claseId, estado: booking.estado } });
    return { success: true, data: serializeData(booking), mensaje: booking.estado === "espera" ? "Te sumamos a la lista de espera" : "Reserva confirmada" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo reservar" };
  }
}

export async function cancelarReserva(claseId: number) {
  try {
    if (!Number.isInteger(claseId) || claseId <= 0) throw new Error("Clase inválida");
    const context = await requireMemberContext();
    await requireTenantModule(context.tenantId, "clases");
    const bookingId = await serializableBooking(() => prisma.$transaction(async (tx) => {
      const booking = await tx.reservaClase.findFirst({ where: { claseId, clienteId: context.clienteId, tenantId: context.tenantId, estado: { in: ["confirmada", "espera"] }, clase: { estado: "programada", inicio: { gt: new Date() } } } });
      if (!booking) throw new Error("Reserva no encontrada");
      const releasedSeat = booking.estado === "confirmada";
      await tx.reservaClase.update({ where: { id: booking.id }, data: { estado: "cancelada", canceladaEn: new Date(), posicionEspera: null } });
      if (releasedSeat) {
        const next = await tx.reservaClase.findFirst({ where: { claseId, tenantId: context.tenantId, estado: "espera" }, orderBy: [{ posicionEspera: "asc" }, { creadaEn: "asc" }] });
        if (next) {
          await tx.reservaClase.update({ where: { id: next.id }, data: { estado: "confirmada", posicionEspera: null } });
          await tx.notificacion.create({ data: { tenantId: context.tenantId, clienteId: next.clienteId, tipo: "reserva_confirmada", titulo: "¡Se liberó tu lugar!", mensaje: "Tu reserva pasó de lista de espera a confirmada." } });
        }
      }
      const remaining = await tx.reservaClase.findMany({ where: { claseId, tenantId: context.tenantId, estado: "espera" }, orderBy: [{ posicionEspera: "asc" }, { creadaEn: "asc" }], select: { id: true } });
      for (const position of normalizeWaitingPositions(remaining)) await tx.reservaClase.update({ where: { id: position.id }, data: { posicionEspera: position.posicionEspera } });
      return booking.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    await writeAudit({ tenantId: context.tenantId, actorClienteId: context.clienteId, accion: "reserva.cancelar", entidad: "ReservaClase", entidadId: bookingId, metadata: { claseId } });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo cancelar" };
  }
}
