"use server";

import { prisma } from "@/lib/prisma";
import { serializeData } from "@/lib/serialize";
import { requireMemberContext } from "@/lib/member-context";
import { requireStaffContext } from "@/lib/tenant-context";
import type { Prisma } from "@prisma/client";

export async function marcarNotificacionLeida(id: number) {
  try {
    const context = await requireMemberContext();
    await prisma.notificacion.updateMany({
      where: { id, clienteId: context.clienteId, tenantId: context.tenantId },
      data: { leidaEn: new Date() },
    });
    return { success: true };
  } catch {
    return { success: false, error: "No autorizado" };
  }
}

export async function marcarTodasNotificacionesLeidas() {
  try {
    const context = await requireMemberContext();
    await prisma.notificacion.updateMany({
      where: { clienteId: context.clienteId, tenantId: context.tenantId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return { success: true };
  } catch {
    return { success: false, error: "No autorizado" };
  }
}

export async function enviarNotificacionSocio(input: {
  tenantId?: number;
  clienteId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  canal?: "in_app" | "push" | "whatsapp" | "email";
  datos?: Prisma.InputJsonValue;
}) {
  try {
    const context = await requireStaffContext();
    if (input.tenantId !== undefined && input.tenantId !== context.tenantId) {
      return { success: false, error: "Tenant no autorizado" };
    }

    const cliente = await prisma.cliente.findFirst({
      where: { id: input.clienteId, tenantId: context.tenantId },
      select: { id: true },
    });
    if (!cliente) return { success: false, error: "Socio no encontrado" };

    const notif = await prisma.$transaction(async (tx) => {
      const notification = await tx.notificacion.create({
        data: {
          tenantId: context.tenantId,
          clienteId: cliente.id,
          tipo: input.tipo,
          titulo: input.titulo,
          mensaje: input.mensaje,
          ...(input.datos !== undefined ? { datos: input.datos } : {}),
        },
      });

      await tx.registroNotificacion.create({
        data: {
          tenantId: context.tenantId,
          clienteId: cliente.id,
          canal: input.canal || "in_app",
          tipo: input.tipo,
          titulo: input.titulo,
          mensaje: input.mensaje,
          estado: "enviado",
        },
      });
      return notification;
    });

    return { success: true, data: serializeData(notif) };
  } catch (error) {
    console.error("Error enviando notificación:", error);
    return { success: false, error: "Error al enviar notificación" };
  }
}
